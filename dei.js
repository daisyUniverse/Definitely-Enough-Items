
// Minecraft recipe format reader by Robin Universe

const fs = require('fs');
const config = require('./data/config.json');
const path = require('path');
const extract = require('extract-zip')
const jarPath = path.join(__dirname, 'jar');
const dataPath = path.join(__dirname, 'data');
const { createCanvas, loadImage } = require('canvas')
const md5File = require('md5-file')
const rimraf = require("rimraf");
const Fuse = require("fuse.js");
const argv = require('yargs')
    .usage("Usage: node cookbook.js 'search term' to search minecraft recipes")
    .command('--scan, -s','scan jar dir, extract if needed and write recipe files to list')
    .alias('s', 'scan')
    .epilog('Cookbook by Robin Universe')
    .argv;

var recipes = [];
var jarindex;

if (argv.scan) {
    console.log('Scanning...')
    scan()
  } else {
    search(argv._[0].replace(" ","_"))
  }

function scan(){ 
    loadedjars = []
    missing = []
    files = fs.readdirSync(jarPath)  // Scan jar directory for .jar files
    files.forEach(function (file) {
        var hash = md5File.sync(jarPath + "/" + file)

        if (!(file in config.JARS)){ // Looks to see if there are any changed to the jar folder since the last time this scan was run. If so, do things
            missing.push(file)
            console.log("New file detected: '" + file + "'")
            config.JARS[file] = hash
            console.log("Adding entry to loadlist")
            writeConf()
            console.log("Entry added")
            loadedjars.push(file)
            console.log("Extracting...")
            uzip(file)
        }

        for (var jarfile in config.JARS){
            if (jarfile == file && !missing.includes(file) ) {
                loadedjars.push(file)
                console.log( "Found " + file + "... Checking MD5 hash...")
                

                if (hash == config.JARS[jarfile]){ // Check the hash of the file against the saved hash in the config
                    console.log("MD5 hash " + hash + " matches hash saved in loadlist.")
                    } else {
                        console.log("MD5 hash does not match!")
                        console.log("Deleing cached files")
                        rimraf.sync(dataPath +  '/' + file.slice(0, -4) + '/');
                        console.log("Extracting jar contents")
                        uzip(file)
                        config.JARS[jarfile] = hash
                        writeConf();
                        console.log("New hash written to loadlist")
                    }
                }
        }
    });

    for (var jarfile in config.JARS) {
        if ( !loadedjars.includes(jarfile) ) {
            console.log("File '" + jarfile + "' not found in jars folder.")
            console.log("Deleting cached files...")
            rimraf.sync(dataPath +  '/' + jarfile.slice(0, -4) + '/');
            console.log("Removing entry from loadlist...")
            delete config.JARS[jarfile]
            writeConf()
        }
    }
    scanRecipes();
}

async function uzip(file){ // unzips the entire contents of a jar to the datapath
    try {
        await extract( jarPath + '/' + file, {dir: dataPath +  '/' + file.slice(0, -4) + '/'})
        console.log("File extracted")
    } catch (err) {
        console.log("Extraction failed: " + err)
    }
}

function writeConf(){ // Writes changes to JSON
    fs.writeFile('./data/config.json', JSON.stringify(config, null, 2), function (err) {
        if (err) return console.log(err);
      });
}


function scanRecipes(){ // scans for all the recipe files in the data directories ( as noted in the loadlist )
    console.log("Scanning recipes...")
    for (var jarfile in config.JARS) {
        var path = (dataPath + "/" + jarfile.slice(0, -4) + "/")
        var modpath = (path + "mcmod.info")
        
        if ( fs.existsSync(modpath) ){ // Check if this is a vanilla minecraft jar or a mod jar
            console.log("Modded jar detected: '" + jarfile + "'")
            var rawmodfile = fs.readFileSync(modpath,'utf8');
            let modfile = JSON.parse(rawmodfile);
            console.log("Mod ID: '" + modfile[0].modid + "'" )
            var jardata = { 
                "jar" : jarfile,
                "datapath" : path,
                "textures" : path + "assets/" + modfile[0].modid + "/textures/",
                "recipes" : {}
            }

            files = fs.readdirSync(path + "assets/" + modfile[0].modid + "/recipes");
            jardata["recipes"] = files.map((file) => ({
                name: file,
                path: path + "assets/" + modfile[0].modid + "/recipes/" + file
            }));
         
        } else { // runs if vanilla
            console.log("No mcmod.info file found in '" + jarfile + "', assuming vanilla")
            var jardata = {
                "jar" : jarfile,
                "datapath" : path,
                "textures" : path + "assets/minecraft/textures/",
                "recipes" : {}
            }

            files = fs.readdirSync(path + "data/minecraft/recipes");
            jardata["recipes"] = files.map((file) => ({
                name: file,
                path: path + "data/minecraft/recipes/" + file
            }));
        }
        recipes.push(jardata) 
    }
    fs.writeFileSync('./data/recipes.json', JSON.stringify(recipes, null, 2), function (err) {
        if (err) return console.log(err);
    }); // saves recipe list to a file to be referenced later on non-scanning searches
    console.log("Recipe list saved to data/recipes.json")
}

function search(term){ // searches the saved recipe list
    var rawrecipejson = fs.readFileSync('./data/recipes.json','utf8');
    let recipes = JSON.parse(rawrecipejson);

    const options = {
        keys: ['recipes.name'],
        findAllMatches: true,
        includeMatches: true,
        threshold:0.1
      }
    const fuse = new Fuse(recipes, options)
    const result = fuse.search(term)
    if (result[Object.keys(result)[Object.keys(result).length - 1]]){
    jarindex = result[Object.keys(result)[Object.keys(result).length - 1]].refIndex
    topindex = result[Object.keys(result)[Object.keys(result).length - 1]].matches[0].refIndex
    texture = recipes[jarindex].textures
    var rawrecipefile = fs.readFileSync(recipes[jarindex].recipes[topindex].path,'utf8');
    let recipefile = JSON.parse(rawrecipefile);
    readRecipe(recipefile, texture)
    }
    else { console.log("No Results :(") }
}

function readRecipe(recipefile,texture){ // Figures out what kind of recipe it is
    var i = 0;

    var crafted = []; // save the crafted item / count
    crafted.push(recipefile.result.item.split(":").pop())
    crafted.push(recipefile.result.count)
    if (recipefile.type.split("_").pop() !== "shapeless"){
        var nogod = JSON.stringify(recipefile.pattern, " ", 0)
                    .replace(/['"]+/g, '')
                    .replace("[","")
                    .replace("]","")
                    .replace(",","\n")
                    .replace(",","\n")
        
        for (var ks in recipefile.key){
            for (var x = 0; x < nogod.length; x++) {
                var type = Object.keys(recipefile.key[Object.keys(recipefile.key)[i]])

                var tagsDir = texture.replace('assets/minecraft/textures/','data/minecraft/tags/') 
                
                if (type == "tag"){ // If it's a tag type, find the tag file and read the first item on its list
                    var tag = recipefile.key[Object.keys(recipefile.key)[i]][type].split(":").pop()
                    if (fs.existsSync(tagsDir + "item/" + tag + ".json")) {
                        tagFile = tagsDir + "item/" + tag + ".json"
                        var rawTagFile = fs.readFileSync(tagFile,'utf8');
                        let tagFileJson = JSON.parse(rawTagFile);
                        item = tagFileJson.values[0].split(":").pop() + ","

                    } else if (fs.existsSync(tagsDir + "blocks/" + tag + ".json")) {
                        tagFile = tagsDir + "blocks/" + tag + ".json"
                        var rawTagFile = fs.readFileSync(tagFile,'utf8');
                        let tagFileJson = JSON.parse(rawTagFile);
                        item = tagFileJson.values[0].split(":").pop() + ","

                    }
                } else if (type == "item" ){
                    var item = recipefile.key[Object.keys(recipefile.key)[i]][type].split(":").pop() + ","
                    
                }
                
                var iKey = Object.keys(recipefile.key)[i]
                var nogod = nogod.replace(" ","air,")
                    .replace( iKey, item )
            }
            i++;
        }
    } else {
        for (var x = 0; x < recipefile.ingredients.length; x++) { //Handle Shapeless recipes
            var type = Object.keys(recipefile.ingredients[Object.keys(recipefile.ingredients)[x]])
            var god = JSON.stringify(recipefile.ingredients[x][type]).split(":").pop().replace('"','') + ","
            if (x == 3 || x == 6) { god = god + "\n" }
            var nogod = god + nogod
            var nogod = nogod.replace("undefined","") // 🥴
        }
    }

    var row = nogod.split("\n")
    for (rows in row) {
        row[rows] = row[rows].slice(0, -1)
        row[rows] = row[rows].split(",") 
        while (row[rows].length < 3){
            row[rows].push("air")
        }
    }

    if (row[0] == "(shapeless)") { 
        delete row[0] }
    
    if (row.length == 2){
        row[2] = row[1]
        row[1] = row[0] // Fill up the empty space in a way that makes sense (tend to have air on top)
        row[0] = ["air", "air", "air"]
    }
    if (row.length == 1){
        row[2] = row[0]
        row[1] = ["air", "air", "air"]
        row[0] = ["air", "air", "air"]
    }
    imageShit(row, texture, crafted)
}

function imageShit(result, texture, crafted){ // Creates the image using canvas
    const width = 560
    const height = 312

    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    const padding = 73
    context.imageSmoothingEnabled = false
    var textureBase = texture
    console.log(crafted)
    res = "cobblestone"

    loadImage('./data/bg.png').then(img => {
        context.drawImage(img, 20 * r, 20 * c);
        const buffer = canvas.toBuffer('image/png') 
        fs.writeFileSync('./image.png', buffer)
    })

    count = crafted[1]
    crafted = crafted[0]

    if (fs.existsSync(texture + "item/" + crafted + ".png")) {crafted = texture + "item/" + crafted + ".png"}
    else if (fs.existsSync(texture + "block/" + crafted + ".png")) {crafted = texture + "block/" + crafted + ".png"}
    
    loadImage(crafted).then(img => {
        context.drawImage(img, 435, 130, 50, 50);
        const buffer = canvas.toBuffer('image/png')
        fs.writeFileSync('./image.png', buffer)
    })

    var r = 0;
    var c = 0;
    for (var row in Object.keys(result)){
        for (var column in result[row]){
            res = result[row][column]
            if (fs.existsSync(texture + "item/" + res + ".png")) {texture = texture + "item/" + res + ".png"}
            else if (fs.existsSync(texture + "block/" + res + ".png")) {texture = texture + "block/" + res + ".png"}
            
            loadImage(texture).then(img => {
                if (r == 3) { r=0; c++ }
                if (c == 3) { c=0; r++ }
                r++
                context.drawImage(img, padding * r - 16, padding * c + 58, 50, 50);
                const buffer = canvas.toBuffer('image/png')
                fs.writeFileSync('./image.png', buffer)
            })
            texture = textureBase
        }
        
    }
}

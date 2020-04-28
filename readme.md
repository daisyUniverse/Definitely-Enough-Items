# DEI

### Definitely Enough Items



a (very heavily) work in progress nodejs script to interpret minecraft ( and eventually modded! ) recipe files

​	**Current usage:**
Note: You must include your own vanilla minecraft jar in the JAR folder

​	`$ node dei.js -s`  or  `--scan` 
Scans the JAR directory to copy their contents to the data folder to search through, and indexes all recipe files it can find for faster searching

​	`$ node dei.js "search term"`
Searches for the crafted item in quotes, returns a .png like this (if it doesn't blow up)

![image](image.png)



​	**Current limitations - Recipes that this won't work with**

- Any recipe that uses an item that is rendered as a 3D model in the minecraft GUI

  ​	( this includes things like torches, chests, beds, fences, etc., )

- Mod recipes are not set up to be rendered yet, but they are set up to be loaded and can be searched through
  

  **Why would you want this?**

I make discord bots, and on my current server, I set up a very jank sort of statement that just plugs whatever words you give it into a url and hopefully that returns a valid url for a crafting table image. The command is used fairly often, but I realized that it could be done significantly better, so I started this. I did not expect this project to be as complicated as it's become, but here I am

Anywho, I plan on just plugging it into my Discord bot. you would say 'scraft search term' and the bot would post whatever image this scripts return



​	**Dependencies**
`[extract-zip, md5-file, rimraf, fuse.js, yargs, canvas]`
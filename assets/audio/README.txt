IT MAZE - audio files
=====================

The game looks for these two music files (MP3 or OGG):

  assets/audio/menu.mp3   plays on the menus and the level select screen
  assets/audio/game.mp3   plays while a level is being played

HOW TO CHANGE THE MUSIC
  1. Put your own file in this folder and name it menu.mp3 / game.mp3
     (replace the old file). That is all, no code change needed.
  2. Or use other file names: open js/script.js and edit the TRACKS list
     near the top (one line per track).

NO FILE YET?
  If a file is missing, the game plays a small built-in tune instead,
  so the volume controls in Settings can always be tested.

TIPS
  - Use royalty-free music (for example OpenGameArt or Pixabay) and keep the credits.
  - Pick a track made to loop, and keep the file small (under 2-3 MB).
  - Volume: Settings (gear icon, also available inside a level) has a music slider
    and a sound effects slider. The choice is remembered in the browser.

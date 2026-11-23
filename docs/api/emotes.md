# Emotes

`src/player/emotes.ts`: `Emotes(jukeboxOn)` gives a first-person view offset (`view()`: dy, dyaw, dpitch) for wave, sit, cheer, dance. G (`CMD_EMOTE`, `intent.emote`, `requestEmote()` for touch buttons) cycles wave, sit, cheer, dance, none. Moving or jumping ends an emote; sitting holds the body still. The dance bobs on the jukebox beat (`BEAT_S`) while `NpcManager.jukeboxOn`. `PlayerController.emotes` applies the offset in `updateView`; the bus event `emote` fires on start.

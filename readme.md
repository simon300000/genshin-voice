# Genshin Voice

Genshin Voice is a dataset of voice lines from the popular game [Genshin Impact](https://genshin.hoyoverse.com/).

Hugging Face 🤗  [Genshin-Voice](https://huggingface.co/datasets/simon3000/genshin-voice)

<!-- STATS -->
Last update at `2024-04-29`

`413429` wavs

`30450` without speaker (7%)

`37295` without transcription (9%)

`720` without inGameFilename (0%)
<!-- STATS_END -->

## Dataset Details

### Dataset Description

The dataset contains voice lines from the game's characters in multiple languages, including Chinese, English, Japanese, and Korean.

The voice lines are spoken by the characters in the game and cover a wide range of topics, including greetings, combat, and story dialogue.

- **Language(s) (NLP):** Chinese, English, Japanese, Korean

## Uses

result.json format:

```json
{
  "0586907bf153a66f.wav": {
    "fileName": "VO_GCG_Monster\\VO_GCG_Skirmisher_Rifle_Fire\\vo_GCG_monster_Skirmisher_Rifle_Fire_Die_01.wem",
    "language": "English(US)",
    "text": "This is... a 【complex】 dialog triggered by the 【editor】!",
    "guid": "48382634-17c2-432f-9372-3ab11f6d84ce",
    "talkRole": "Mei",
    "talkRoleType": "TALK_ROLE_NPC",
    "gameTrigger": "Card",
    "gameTriggerArgs": 101
  },
}
```

## Dataset Creation

### Source Data

The data was obtained by unpacking the [Genshin Impact](https://genshin.hoyoverse.com/) game.

#### Data Collection and Processing

Please refer to [Genshin-Voice](https://github.com/simon300000/genshin-voice) and [w4123/GenshinVoice](https://github.com/w4123/GenshinVoice) for more information on how the data was processed.

#### Who are the source data producers?

The source data producers are the developers of the game, miHoYo.

### Annotations

The dataset contains official annotations from the game, including language, speaker name, and transcription.

## Bias, Risks, and Limitations

Annotations are incomplete. Some voice lines are missing speaker names and transcriptions.

### Recommendations

Users should be made aware of the risks, biases and limitations of the dataset.

Speaker names can be partially inferred from the ingame filenames.

## Licensing Information

Copyright © COGNOSPHERE. All Rights Reserved.

## More Information

I can upload wav files on demand.

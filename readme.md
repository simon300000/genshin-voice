# Genshin Voice

Genshin Voice is a dataset of voice lines from the popular game [Genshin Impact](https://genshin.hoyoverse.com/).

Hugging Face 🤗  [Genshin-Voice](https://huggingface.co/datasets/simon3000/genshin-voice)

<!-- STATS -->
Last update at `2024-08-30`

`463383` wavs

`20231` without speaker (4%)

`24819` without transcription (5%)

`602` without inGameFilename (0%)
<!-- STATS_END -->

## Dataset Details

### Dataset Description

The dataset contains voice lines from the game's characters in multiple languages, including Chinese, English, Japanese, and Korean.

The voice lines are spoken by the characters in the game and cover a wide range of topics, including greetings, combat, and story dialogue.

- **Language(s) (NLP):** Chinese, English, Japanese, Korean

## Uses

To install Hugging Face's datasets library, follow the instructions from [this link](https://huggingface.co/docs/datasets/installation#audio).

### Example: Load the dataset and filter for Chinese voices of Ganyu with transcriptions

```python
from datasets import load_dataset
import soundfile as sf
import os

# Load the dataset
dataset = load_dataset('simon3000/genshin-voice', split='train', streaming=True)

# Filter the dataset for Chinese voices of Ganyu with transcriptions
chinese_ganyu = dataset.filter(lambda voice: voice['language'] == 'Chinese' and voice['speaker'] == 'Ganyu' and voice['transcription'] != '')

# Create a folder to store the audio and transcription files
ganyu_folder = 'ganyu'
os.makedirs(ganyu_folder, exist_ok=True)

# Process each voice in the filtered dataset
for i, voice in enumerate(chinese_ganyu):
  audio_path = os.path.join(ganyu_folder, f'{i}_audio.wav')  # Path to save the audio file
  transcription_path = os.path.join(ganyu_folder, f'{i}_transcription.txt')  # Path to save the transcription file
  
  # Save the audio file
  sf.write(audio_path, voice['audio']['array'], voice['audio']['sampling_rate'])

  # Save the transcription file
  with open(transcription_path, 'w') as transcription_file:
    transcription_file.write(voice['transcription'])

  print(f'{i} done')  # Print the progress
```

### You unpacked the game and just want to know what the wavs are about

result.json format: (subject to change)

```json
{
  "9b5502fb1b83cb97.wav": {
    "inGameFilename": "VO_friendship\\VO_raidenShogun\\vo_raidenEi_dialog_pendant.wem",
    "filename": "9b5502fb1b83cb97.wav",
    "language": "English(US)",
    "transcription": "Really? So in all this time, no new Electro Visions have appeared in the outside world? Well, what I can say on this topic is subject to certain constraints, but... it is not by my will that Visions are granted or denied. The key is people's desire, and... well, there's another side to it too.",
    "speaker": "Raiden Shogun",
    "talkRoleType": "",
    "talkRoleID": "",
    "guid": "f8e72b65-6c0a-4df1-a2f0-2bb08dbeab75",
    "voiceConfigs": [
      {
        "gameTrigger": "Fetter",
        "gameTriggerArgs": 3001,
        "avatarName": "Switch_raidenShogun"
      }
    ]
  }
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

Speakers and transcriptions may contain markups and placeholders: `#<color=#37FFFF>パイモン：</color>{NICKNAME}、すごく怖い悪夢を見たことってあるか？\\n<color=#37FFFF>{NICKNAME}：...`

### Recommendations

Users should be made aware of the risks, biases and limitations of the dataset.

Speaker names can be partially inferred from the ingame filenames.

## Licensing Information

Copyright © COGNOSPHERE. All Rights Reserved.

## More Information

I can upload wav files on demand.

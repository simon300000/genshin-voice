import json
from datasets import Dataset, Audio
from huggingface_hub import HfApi

audioFolderDir = 'genshin-voice-wav/'

api = HfApi()

api.upload_file(
    path_or_fileobj=audioFolderDir + "README.md",
    path_in_repo="README.md",
    repo_id="simon3000/genshin-voice",
    repo_type="dataset"
)

api.upload_file(
    path_or_fileobj="result.json",
    path_in_repo="result.json",
    repo_id="simon3000/genshin-voice",
    repo_type="dataset"
)

print('Loading metadata.jsonl')

with open(audioFolderDir+ 'metadata.jsonl', 'r', encoding='utf-8') as json_file:
    voiceList = [json.loads(line) for line in json_file]

print('Creating dataset')

dataset = Dataset.from_dict({
    "audio": [audioFolderDir + voice['file_name'] for voice in voiceList],
    "transcription": [voice['transcription'] for voice in voiceList],
    "language": [voice['language'] for voice in voiceList],
    "speaker": [voice['speaker'] for voice in voiceList],
    "speaker_type": [voice['speaker_type'] for voice in voiceList],
    "type": [voice['gameTrigger'] for voice in voiceList],
    "inGameFilename": [voice['inGameFilename'] for voice in voiceList],
    }).cast_column("audio", Audio())

print('Pushing dataset')

dataset.push_to_hub("genshin-voice", max_shard_size="5GB")

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

import { join, basename } from 'path'
import { writeFile, copyFile, mkdir, rm } from 'fs/promises'

import { encodeFNV64, findJSON, findWAV, readJSON, readJSONs, readTextMap, updateStats, copyReadme } from './hoyo-voice-extractor/index.js'

const TEXT_MAP_MAP = {
  'Chinese': 'TextMapCHS.json',
  'English(US)': 'TextMapEN.json',
  'Japanese': 'TextMapJP.json',
  'Korean': 'TextMapKR.json'
} as const

const LANGUAGES = Object.keys(TEXT_MAP_MAP) as Array<keyof typeof TEXT_MAP_MAP>

const WAV_PATH = 'result/wav'
const WAV_DESTINATION = 'genshin-voice-wav/wavs'

const voiceMap = {} as Record<string, Voice>
const dialogMap = new Map<number, Dialog>()
const npcNameHashMap = new Map<string, number>()

const convertOldVoice = (oldVoice: OldVoice | GoodVoice): GoodVoice => {
  if ('guid' in oldVoice) {
    return oldVoice
  } else if ('Guid' in oldVoice) {
    const { Guid, GameTrigger, ParentID, SourceNames, ...rest } = oldVoice
    return {
      guid: Guid,
      gameTrigger: GameTrigger,
      parentID: ParentID,
      sourceNames: SourceNames,
      ...rest
    }
  }
  return oldVoice
}

const readVoiceMap = async (maps: VoiceMap) => {
  for (const voice of Object.values(maps).map(convertOldVoice)) {
    if ('sourceNames' in voice) {
      const { guid, gameTrigger, gameTriggerArgs, sourceNames = [] } = voice
      for (const { sourceFileName } of sourceNames) {
        for (const language of LANGUAGES) {
          const fileName = `${language}\\${sourceFileName}`
          const hash = encodeFNV64(fileName)
          const wavName = `${hash}.wav`
          const voiceData = voiceMap[wavName]
          if (voiceData) {
            voiceMap[wavName] = { ...voiceData, inGameFilename: sourceFileName, language, guid, gameTrigger, gameTriggerArgs }
          }
        }
      }
    }
  }
}

const readTalk = async (talk: Talk | {}) => {
  if ('dialogList' in talk) {
    const { dialogList } = talk
    for (const { id, ...dialog } of dialogList) {
      dialogMap.set(id, { id, ...dialog })
    }
  }
}

const readNPCJSON = async (filePath: string) => {
  const json = await readJSON<NPCConfig>(filePath)
  for (const npc of json) {
    const { nameTextMapHash, id } = npc
    npcNameHashMap.set(String(id), nameTextMapHash)
  }
}

const subDirs = (wav: string) => {
  const name = wav.split('.').join('')
  return `${name.slice(0, 2)}/${name.slice(2, 4)}`
}

console.log('Reading result/wav...')

for (const wav of await findWAV(WAV_PATH)) {
  voiceMap[basename(wav)] = {
    inGameFilename: '',
    language: '',
    transcription: '',
    speaker: '',
    talkRoleType: '',
    talkRoleID: '',
    guid: '',
    gameTrigger: '',
    gameTriggerArgs: 0
  }
}

console.log(Object.keys(voiceMap).length, 'wavs found')

console.log('Reading GenshinData/BinOutput/Voice...')

const voiceJSON = await findJSON('GenshinData/BinOutput/Voice')
const voiceMaps = await readJSONs<VoiceMap>(voiceJSON)
voiceMaps.forEach(readVoiceMap)

console.log('Reading GenshinData/BinOutput/Talk...')

const talkJSON = await findJSON('GenshinData/BinOutput/Talk')
const talks = await readJSONs<Talk | {}>(talkJSON)
talks.forEach(readTalk)

console.log('Reading GenshinData/TextMap...')
const textMaps = await readTextMap('GenshinData', TEXT_MAP_MAP)

console.log('Reading NpcExcelConfigData...')

await readNPCJSON('GenshinData/ExcelBinOutput/NpcExcelConfigData.json')

console.log('Matching...')

for (const voice of Object.values(voiceMap)) {
  const { gameTriggerArgs, language } = voice
  if (!language || !gameTriggerArgs) {
    continue
  }
  const dialog = dialogMap.get(gameTriggerArgs)
  if (!dialog) {
    continue
  }
  const { talkContentTextMapHash: hash, talkRole: { type, id, _id } } = dialog
  const talkRoleID = id || _id || ''
  if (hash) {
    const text = textMaps[language][hash]
    if (text !== undefined) {
      voice.transcription = text
    }
  }
  if (type) {
    voice.talkRoleType = type
    if (type === 'TALK_ROLE_NPC') {
      const npc = npcNameHashMap.get(talkRoleID)
      if (npc) {
        voice.speaker = textMaps['English(US)'][npc] || ''
      }
    }
  }
}

console.log('Writing result.json')

await writeFile('result.json', JSON.stringify(voiceMap))

await updateStats(voiceMap, 'readme.md')

console.log('Removing old dataset...')

await rm(WAV_DESTINATION, { recursive: true, force: true })

console.log('Creating directories...')

const dirs = new Set<string>()
for (const wav of Object.keys(voiceMap)) {
  dirs.add(subDirs(wav))
}

for (const dir of dirs) {
  await mkdir(join(WAV_DESTINATION, dir), { recursive: true })
}

console.log('Copying files to dataset...')

const copyPromise = []
for (const wav of await findWAV(WAV_PATH)) {
  const filename = basename(wav)
  copyPromise.push(copyFile(wav, join(WAV_DESTINATION, subDirs(filename), filename)))
}

await Promise.all(copyPromise)

const metadata = Object.entries(voiceMap)
  .map(([wav, { transcription, language, speaker, talkRoleType: speaker_type }]) => {
    return JSON.stringify({
      file_name: `wavs/${subDirs(wav)}/${wav}`,
      transcription,
      language,
      speaker,
      speaker_type
    })
  })
  .join('\n')

await writeFile('genshin-voice-wav/metadata.jsonl', metadata)
const huggingfaceMetadata = `---
task_categories:
- audio-classification
- automatic-speech-recognition
- text-to-speech
language:
- zh
- en
- ja
- ko
pretty_name: Genshin Voice
---`

await copyReadme('readme.md', 'genshin-voice-wav/README.md', huggingfaceMetadata)

type Voice = {
  inGameFilename: string
  language: typeof LANGUAGES[number] | ''
  transcription: string
  speaker: string
  talkRoleType: string
  talkRoleID: string
  guid: string
  gameTrigger: string
  gameTriggerArgs: number
}

type VoiceSource = {
  sourceFileName: string
  rate: number
  avatarName: string
  emotion: string
}

type OldVoice = {
  Guid: string
  playRate: number
  GameTrigger: string
  gameTriggerArgs: number
  personalConfig: number
  ParentID: string
  SourceNames?: VoiceSource[]
}

type GoodVoice = {
  guid: string
  playRate: number
  gameTrigger: string
  gameTriggerArgs: number
  personalConfig: number
  parentID: string
  sourceNames?: VoiceSource[]
}

type Dialog = {
  id: number
  nextDialogs: number[]
  talkRole: {
    type: 'TALK_ROLE_NPC'
    _id?: string
    id?: string
  }
  talkContentTextMapHash: number
  talkAssetPath: string
  talkAssetPathAlter: string
  talkAudioName: string
  actionBefore: string
  actionWhile: string
  actionAfter: string
  optionIcon: string
}

type Talk = {
  talkId: number
  dialogList: Dialog[]
}

type VoiceMap = Record<string, OldVoice | GoodVoice>

type NPC = {
  jsonName: string
  alias: string
  scriptDataPath: string
  luaDataPath: string
  dyePart: string
  billboardIcon: string
  templateEmotionPath: string
  actionIdList: string[]
  uniqueBodyId: number
  id: number
  nameTextMapHash: number
  prefabPathHash: number
  campID: number
  LODPatternName: string
}

type NPCConfig = NPC[]

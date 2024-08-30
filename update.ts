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
  const voiceMaps = Object.values(maps).filter(v => typeof v !== 'string') as (OldVoice | GoodVoice)[]
  for (const voice of voiceMaps.map(convertOldVoice)) {
    if ('sourceNames' in voice) {
      const { guid, gameTrigger, gameTriggerArgs, sourceNames = [] } = voice
      for (const { sourceFileName, avatarName } of sourceNames) {
        for (const language of LANGUAGES) {
          const fileName = `${language}\\${sourceFileName}`
          const hash = encodeFNV64(fileName)
          const wavName = `${hash}.wav`
          const voiceData = voiceMap[wavName]
          if (voiceData) {
            voiceData.inGameFilename = sourceFileName
            voiceData.language = language
            voiceData.guid = voiceData.guid || guid
            voiceMap[wavName].voiceConfigs.push({ gameTrigger, gameTriggerArgs, avatarName })
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
    filename: basename(wav),
    language: '',
    transcription: '',
    speaker: '',
    talkRoleType: '',
    talkRoleID: '',
    guid: '',
    voiceConfigs: []
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

console.log('Reading NpcExcelConfigData.json')

await readNPCJSON('GenshinData/ExcelBinOutput/NpcExcelConfigData.json')

console.log('Reading AvatarExcelConfigData.json')

const avatarExcelConfigData = await readJSON<AvatarExcelConfig>('GenshinData/ExcelBinOutput/AvatarExcelConfigData.json')
const avatarExcelConfig = Object.fromEntries(avatarExcelConfigData.filter(({ useType }) => useType === 'AVATAR_FORMAL').map(({ id, nameTextMapHash, iconName }) => [iconName.replace('UI_AvatarIcon', 'ConfigAvatar'), { id, nameTextMapHash }]))
const avatarConfigKeys = Object.keys(avatarExcelConfig)
const avatarIdNameHashMap = Object.fromEntries(Object.values(avatarExcelConfig).map(({ id, nameTextMapHash }) => [id, nameTextMapHash]))

console.log('Reading GenshinData/BinOutput/Avatar...')

const avatarConfigs = await Promise.all(avatarConfigKeys.map(async k => [k, await readJSON<AvatarConfig>(`GenshinData/BinOutput/Avatar/${k}.json`)] as const))
const avatarConfigMap = Object.fromEntries(avatarConfigs.map(([k, v]) => [v.audio.voiceSwitch.text.toLowerCase(), k]))

console.log('Reading GenshinData/ExcelBinOutput/FettersExcelConfigData.json')

const fettersExcelConfigData = await readJSON<FettersExcelConfig>('GenshinData/ExcelBinOutput/FettersExcelConfigData.json')
const fettersTextHashMap = Object.fromEntries(fettersExcelConfigData.map(({ voiceFile, avatarId, voiceFileTextTextMapHash }) => [`${voiceFile}_${avatarId}`, { voiceFileTextTextMapHash }]))

console.log('Reading GenshinData/ExcelBinOutput/GCGTalkDetailExcelConfigData.json')
const gcgTalkDetailExcelConfigData = await readJSON<GCGTalkDetailExcelConfigData>('GenshinData/ExcelBinOutput/GCGTalkDetailExcelConfigData.json')
const gcgTalkDetailExcelConfig = Object.fromEntries(gcgTalkDetailExcelConfigData.flatMap(({ talkContent, talkVoiceId, talkCharacterId }) => talkVoiceId.filter(id => id !== 0).map((talkVoiceId, i) => [talkVoiceId, { talkContent: talkContent[i], talkCharacterId: talkCharacterId[i] }])))

console.log('Reading GenshinData/ExcelBinOutput/GCGCharExcelConfigData.json')
const gcgCharExcelConfigData = await readJSON<GCGCharExcelConfigData>('GenshinData/ExcelBinOutput/GCGCharExcelConfigData.json')
const gcgCharNameHashMap = Object.fromEntries(gcgCharExcelConfigData.filter(({ voiceSwitch }) => voiceSwitch).map(({ voiceSwitch, nameTextMapHash }) => [voiceSwitch.toLowerCase(), nameTextMapHash]))

console.log('Reading GenshinData/ExcelBinOutput/GCGTutorialTextExcelConfigData.json')
const gcgTutorialTextExcelConfigData = await readJSON<GCGTutorialTextExcelConfigData>('GenshinData/ExcelBinOutput/GCGTutorialTextExcelConfigData.json')
const gcgTutorialTextHashMap = Object.fromEntries(gcgTutorialTextExcelConfigData.filter(({ voiceTriggerId }) => voiceTriggerId).map(({ voiceTriggerId, commentTextMapHash }) => [voiceTriggerId as number, commentTextMapHash]))

console.log('Reading GenshinData/ExcelBinOutput/ReminderExcelConfigData.json')
const reminderExcelConfigData = await readJSON<ReminderExcelConfigData>('GenshinData/ExcelBinOutput/ReminderExcelConfigData.json')
const reminderTextHashMap = Object.fromEntries(reminderExcelConfigData.map(({ id, speakerTextMapHash, contentTextMapHash }) => [id, { speakerTextMapHash, contentTextMapHash }]))

console.log('Matching...')

for (const voice of Object.values(voiceMap)) {
  const { language, voiceConfigs } = voice
  if (!language) {
    continue
  }
  for (const { gameTrigger, gameTriggerArgs, avatarName } of voiceConfigs) {
    if (gameTrigger === 'Dialog') {
      const dialog = dialogMap.get(gameTriggerArgs)
      if (!dialog) {
        continue
      }
      const { talkContentTextMapHash: hash, talkRole: { type, id, _id }, talkRoleNameTextMapHash } = dialog
      const talkRoleID = id || _id || ''
      if (hash) {
        const text = textMaps[language][hash]
        if (text !== undefined) {
          voice.transcription = text
        }
      }
      if (talkRoleNameTextMapHash) {
        voice.speaker = textMaps['English(US)'][talkRoleNameTextMapHash] || voice.speaker
      }
      if (type) {
        voice.talkRoleType = type
        if (type === 'TALK_ROLE_NPC') {
          const npc = npcNameHashMap.get(talkRoleID)
          if (npc) {
            const newSpeaker = textMaps['English(US)'][npc]
            voice.speaker = newSpeaker || voice.speaker
          }
        }
      }
    }
    if (gameTrigger === 'Fetter') {
      const avatar = avatarConfigMap[avatarName.toLowerCase()]
      const { nameTextMapHash, id } = avatarExcelConfig[avatar]
      const speaker = textMaps['English(US)'][nameTextMapHash]
      if (speaker) {
        voice.speaker = speaker
      }
      const fetterTextHash = fettersTextHashMap[`${gameTriggerArgs}_${id}`]
      if (fetterTextHash) {
        const hash = fetterTextHash.voiceFileTextTextMapHash
        const text = textMaps[language][hash]
        voice.transcription = text
      }
    }
    if (gameTrigger === 'Card') {
      if (avatarName) {
        const charNameHash = gcgCharNameHashMap[avatarName.toLowerCase()] || avatarConfigMap[avatarName.toLowerCase()] && avatarExcelConfig[avatarConfigMap[avatarName.toLowerCase()]].nameTextMapHash
        const charName = textMaps['English(US)'][charNameHash]
        if (charName) {
          voice.speaker = charName
        }
      }
      const talk = gcgTalkDetailExcelConfig[gameTriggerArgs]
      if (talk) {
        const { talkContent, talkCharacterId } = talk
        const text = textMaps[language][talkContent]
        voice.transcription = text
        const nameHash = avatarIdNameHashMap[talkCharacterId]
        const name = textMaps['English(US)'][nameHash]
        if (name) {
          voice.speaker = name
        }
      } else {
        const tutorialHash = gcgTutorialTextHashMap[gameTriggerArgs]
        if (tutorialHash) {
          const text = textMaps[language][tutorialHash]
          voice.transcription = text || voice.transcription
        }
      }
    }
    if (gameTrigger === 'DungeonReminder') {
      const reminder = reminderTextHashMap[gameTriggerArgs]
      if (reminder) {
        const { speakerTextMapHash, contentTextMapHash } = reminder
        const speaker = textMaps['English(US)'][speakerTextMapHash]
        const content = textMaps[language][contentTextMapHash]
        if (speaker) {
          voice.speaker = speaker
        }
        if (content) {
          voice.transcription = content
        }
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
  .map(([wav, { transcription, language, speaker, talkRoleType: speaker_type, voiceConfigs, inGameFilename }]) => {
    const [{ gameTrigger = '' } = {}] = voiceConfigs
    return JSON.stringify({
      file_name: `wavs/${subDirs(wav)}/${wav}`,
      transcription,
      language,
      speaker,
      speaker_type,
      gameTrigger,
      inGameFilename,
      voiceConfigs
    })
  })
  .sort()
  .join('\n')

await writeFile('metadata.jsonl', metadata)
await copyFile('metadata.jsonl', 'genshin-voice-wav/metadata.jsonl')

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

type GameTrigger = 'Fetter' | 'Dialog' | 'Card' | 'DungeonReminder'

type VoiceConfig = {
  gameTrigger: GameTrigger
  gameTriggerArgs: number
  avatarName: string
}

type Voice = {
  inGameFilename: string
  filename: string
  language: typeof LANGUAGES[number] | ''
  transcription: string
  speaker: string
  talkRoleType: string
  talkRoleID: string
  guid: string
  voiceConfigs: VoiceConfig[]
}

type VoiceSource = {
  sourceFileName: string
  rate: number
  avatarName: string
  emotion: string
  gender?: 1 | 2
}

type OldVoice = {
  Guid: string
  playRate: number
  GameTrigger: GameTrigger
  gameTriggerArgs: number
  personalConfig: number
  ParentID: string
  SourceNames?: VoiceSource[]
}

type GoodVoice = {
  guid: string
  playRate: number
  gameTrigger: GameTrigger
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
  talkRoleNameTextMapHash?: number
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

type VoiceMap = Record<string, OldVoice | GoodVoice | string>

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

type AvatarExcelConfig = {
  useType: 'AVATAR_ABANDON' | 'AVATAR_FORMAL'
  iconName: string
  id: number
  nameTextMapHash: number
}[]

type AvatarConfig = {
  audio: {
    voiceSwitch: {
      text: string
    }
  }
}

type FettersExcelConfig = {
  voiceFile: string
  avatarId: number
  voiceFileTextTextMapHash: number
}[]

type GCGTalkDetailExcelConfigData = {
  talkDetailId: number
  talkContent: number[]
  talkVoiceId: number[]
  talkCharacterId: number[]
  talkEmoji: string[]
}[]

type GCGCharExcelConfigData = {
  voiceSwitch: string
  nameTextMapHash: number
}[]

type GCGTutorialTextExcelConfigData = {
  id: number
  commentTextMapHash: number
  voiceTriggerId?: number
}[]

type ReminderExcelConfigData = {
  id: number
  speakerTextMapHash: number
  contentTextMapHash: number
}[]

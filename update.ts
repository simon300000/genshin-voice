import { join, basename } from 'path'
import { readFile, writeFile, copyFile, mkdir, rm } from 'fs/promises'

import { encodeFNV64, findFiles } from './hoyo-voice-extractor/index.js'

const TEXT_MAP_MAP = {
  'Chinese': 'TextMapCHS.json',
  'English(US)': 'TextMapEN.json',
  'Japanese': 'TextMapJP.json',
  'Korean': 'TextMapKR.json'
} as const

const LANGUAGES = Object.keys(TEXT_MAP_MAP) as Array<keyof typeof TEXT_MAP_MAP>
const TEXTMAPS = Object.values(TEXT_MAP_MAP) as Array<typeof TEXT_MAP_MAP[typeof LANGUAGES[number]]>

const WAV_PATH = 'result/wav'
const WAV_DESTINATION = 'genshin-voice-wav/wavs'

const voiceMap = {} as Record<string, Voice>
const dialogMap = new Map<number, Dialog>()
const textMaps = Object.fromEntries(Object.values(TEXT_MAP_MAP).map(l => [l, {}])) as Record<typeof TEXTMAPS[number], TextMap>
const npcNameHashMap = new Map<number, number>()

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

const readVoiceJSON = async (filePath: string) => {
  const content = await readFile(filePath, 'utf-8')
  const json = JSON.parse(content) as VoiceMap
  for (const voice of Object.values(json).map(convertOldVoice)) {
    if ('sourceNames' in voice) {
      const { guid, gameTrigger, gameTriggerArgs, sourceNames = [] } = voice
      for (const { sourceFileName } of sourceNames) {
        for (const language of LANGUAGES) {
          const fileName = `${language}\\${sourceFileName}`
          const hash = encodeFNV64(fileName)
          const wavName = `${hash}.wav`
          if (voiceMap[wavName]) {
            voiceMap[wavName] = { fileName: sourceFileName, language, text: '', talkRole: '', talkRoleType: '', guid, gameTrigger, gameTriggerArgs }
          }
        }
      }
    }
  }
}

const readTalkJSON = async (filePath: string) => {
  const content = await readFile(filePath, 'utf-8')
  const json = JSON.parse(content) as Talk | {}
  if ('dialogList' in json) {
    const { dialogList } = json
    for (const { id, ...dialog } of dialogList) {
      dialogMap.set(id, { id, ...dialog })
    }
  }
}

const readTextMap = async (map: typeof TEXTMAPS[number]) => {
  const content = await readFile(join('GenshinData', 'TextMap', map), 'utf-8')
  const json = JSON.parse(content) as TextMap
  textMaps[map] = json
}

const readNPCJSON = async (filePath: string) => {
  const content = await readFile(filePath, 'utf-8')
  const json = JSON.parse(content) as NPCConfig
  for (const npc of json) {
    const { nameTextMapHash, id } = npc
    npcNameHashMap.set(id, nameTextMapHash)
  }
}

const findJSON = async (path: string) => findFiles(path, '.json')

const subDirs = (wav: string) => {
  const name = wav.split('.').join('')
  return `${name.slice(0, 2)}/${name.slice(2, 4)}`
}

console.log('Reading result/wav...')

for (const wav of await findFiles(WAV_PATH, '.wav')) {
  voiceMap[basename(wav)] = {
    fileName: '',
    language: '',
    text: '',
    talkRole: '',
    talkRoleType: '',
    guid: '',
    gameTrigger: '',
    gameTriggerArgs: 0
  }
}

console.log(Object.keys(voiceMap).length, 'wavs found')

console.log('Reading GenshinData/BinOutput/Voice...')

const voiceJSON = await findJSON('GenshinData/BinOutput/Voice')
while (voiceJSON.length) {
  const batch = voiceJSON.splice(0, 64)
  await Promise.all(batch.map(readVoiceJSON))
}

console.log('Reading GenshinData/BinOutput/Talk...')

const talkJSON = await findJSON('GenshinData/BinOutput/Talk')
while (talkJSON.length) {
  const batch = talkJSON.splice(0, 64)
  await Promise.all(batch.map(readTalkJSON))
}

console.log('Reading GenshinData/TextMap...')

for (const map of TEXTMAPS) {
  await readTextMap(map)
}

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
  const { talkContentTextMapHash: hash, talkRole: { type } } = dialog
  if (hash) {
    const text = textMaps[TEXT_MAP_MAP[language]][hash]
    if (text !== undefined) {
      voice.text = text
    }
  }
  if (type) {
    voice.talkRoleType = type
    if (type === 'TALK_ROLE_NPC') {
      const npc = npcNameHashMap.get(gameTriggerArgs)
      if (npc) {
        const text = textMaps['TextMapEN.json'][npc]
        voice.talkRole = text || ''
      }
    }
  }
}

console.log('Writing result.json')

await writeFile('result.json', JSON.stringify(voiceMap))

let noRole = 0
let noText = 0
let noFileName = 0

for (const voice of Object.values(voiceMap)) {
  if (!voice.talkRole) {
    noRole++
  }
  if (!voice.text) {
    noText++
  }
  if (!voice.fileName) {
    noFileName++
  }
}

const currentDate = new Date().toISOString().replace(/T.*/, '')

const stats = `<!-- STATS -->
Last update at \`${currentDate}\`

\`${Object.keys(voiceMap).length}\` wavs

\`${noRole}\` without speaker

\`${noText}\` without transcription

\`${noFileName}\` without file_name
<!-- STATS_END -->`

console.log(stats)

const readme = await readFile('readme.md', 'utf-8')
const updatedReadme = readme.replace(/<!-- STATS -->[\s\S]*<!-- STATS_END -->/, stats)
await writeFile('readme.md', updatedReadme)

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
for (const wav of await findFiles(WAV_PATH, '.wav')) {
  const filename = basename(wav)
  copyPromise.push(copyFile(wav, join(WAV_DESTINATION, subDirs(filename), filename)))
}

await Promise.all(copyPromise)

const metadata = Object.entries(voiceMap)
  .map(([wav, { text: transcription, language, talkRole: speaker, talkRoleType: speaker_type }]) => {
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
await writeFile('genshin-voice-wav/README.md', `${huggingfaceMetadata}\n\n${updatedReadme}`)

type Voice = {
  fileName: string
  language: typeof LANGUAGES[number] | ''
  text: string
  talkRole: string
  talkRoleType: string
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
    id: string
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

type TextMap = Record<string, string>

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

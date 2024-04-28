import { join } from 'path'

import { checkResultFolder, unpackPCKs } from './hoyo-voice-extractor/index.js'

const PCK_SOURCE = join(import.meta.dirname, 'AudioAssets')
const RESULT = join(import.meta.dirname, 'result')
const WEM_PATH = join(RESULT, 'wem')
const WAV_PATH = join(RESULT, 'wav')

await checkResultFolder(RESULT)

await unpackPCKs(PCK_SOURCE, WEM_PATH, WAV_PATH)

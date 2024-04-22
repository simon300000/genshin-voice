import { join } from 'path'

import { checkResultFolder, importPCK, unpack, exportFiles, cleanPCK } from './hoyo-voice-extractor/index.js'

const PCK_SOURCE = join(import.meta.dirname, 'AudioAssets')
const RESULT = join(import.meta.dirname, 'result')

await checkResultFolder(RESULT)

await importPCK(PCK_SOURCE)

await unpack()

await exportFiles(RESULT)

await cleanPCK()

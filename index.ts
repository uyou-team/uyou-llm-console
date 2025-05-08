import { file, write } from 'bun'
import readline from 'node:readline'
import path from 'node:path'
import { Ollama, type Message } from 'ollama'
import packageJSON from './package.json'
import i18n from './i18n'

export interface Config {
    apiLink: string
    model?: string
    systemPrompt?: string
    autoInChat?: 'on' | 'off'
}

let ollama: Ollama

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

async function choose() {
    rl.question((await i18n()).chooeseQuestion, async (answer) => {
        if (answer === '1') {
            setModel()
        } else if (answer === '2') {
            setApi()
        } else if (answer === '3') {
            setSystemPrompt()
        } else if (answer === '/exit'.toLowerCase()) {
            rl.close()
        } else if (answer === '4') {
            const config = await file(path.resolve(__dirname, 'config.json')).json()
            const models = await (await ollama.list()).models
            console.log(`\n${(await i18n()).startChat} (${(await i18n()).model}${config.model ? config.model : models[0].model})`)
            
            if (config.systemPrompt) {
                const systemPrompt = config.systemPrompt
                console.log(`\n${(await i18n()).system}${systemPrompt}`);   
            }
            chat()
        } else {
            settings()
        }
    })
}

async function setApi() {
    rl.question((await i18n()).setApi, async (answer) => {
        const apiLink = answer.trim()
        if (!apiLink) {
            console.log((await i18n()).invalidInput)
            setApi()
            return
        }
        const config = {
            apiLink: apiLink
        }
        write(path.resolve(__dirname, 'config.json'), JSON.stringify(config))
            .then(async () => {
                console.log((await i18n()).setApiSuccess)
                init()
                choose()
            })
            .catch((err) => console.error('Error writing to file:', err))
    })
}

async function setModel() {
    const modelList = await (await ollama.list()).models
    const question = modelList.map((model, index) => `${index + 1}: ${model.model}`).join('\n')
    rl.question(`${(await i18n()).chooseModel}\n${question}\n`, (answer) => {
        file(path.resolve(__dirname, 'config.json'))
            .json()
            .then(async (config) => {
                const modelIndex = parseInt(answer.trim()) - 1
                if (modelIndex < 0 || modelIndex >= modelList.length) {
                    console.log((await i18n()).invalidInput)
                    setModel()
                    return
                }
                config.model = modelList[modelIndex].model
                write(path.resolve(__dirname, 'config.json'), JSON.stringify(config))
                    .then(async () => {
                        console.log((await i18n()).setModelSuccess)
                        choose()
                    })
                    .catch((err) => console.error('Error writing to file:', err))
            })
            .catch((err) => console.error('Error reading file:', err))
    })
}

async function setSystemPrompt() {
    rl.question((await i18n()).setSystemPrompt, (answer) => {
        file(path.resolve(__dirname, 'config.json'))
            .json()
            .then((config) => {
                config.systemPrompt = answer.trim()
                write(path.resolve(__dirname, 'config.json'), JSON.stringify(config))
                    .then(async () => {
                        console.log((await i18n()).setSystemPromptSuccess)
                        choose()
                    })
                    .catch((err) => console.error('Error writing to file:', err))
            })
            .catch((err) => console.error('Error reading file:', err))
    })
}

const chatList: Message[] = []

async function chat() {
    const config = await file(path.resolve(__dirname, 'config.json')).json()
    const models = await (await ollama.list()).models

    rl.question((await i18n()).you, async (input) => {
        if (input.toLowerCase() === '/exit') {
            rl.close()
            return
        }
        if (input.toLowerCase() === '/back' || input.toLowerCase() === '/choose') {
            choose()
            chatList.length = 0
            return
        }

        chatList.push({ role: 'user', content: input })
        const response = await ollama.chat({
            model: config.model ? config.model : models[0].model,
            messages: [{ role: 'system', content: config.systemPrompt }, ...chatList],
            stream: true
        })
        console.log((await i18n()).bot)
        let botMsg = ''
        for await (const part of response) {
            process.stdout.write(part.message.content)
            botMsg += part.message.content
        }
        chatList.push({ role: 'assistant', content: botMsg })
        console.log('\n')
        chat()
    })
}

async function settings() {
    const config: Config = await file(path.resolve(__dirname, 'config.json')).json()

    rl.question(`${(await i18n()).otherSettings}(${config.autoInChat ? (await i18n())[config.autoInChat] : (await i18n()).off})\n`, async (answer) => {
        if (answer === '1') {
            const autoInChat = config.autoInChat === 'on' ? 'off' : 'on'
            config.autoInChat = autoInChat
            write(path.resolve(__dirname, 'config.json'), JSON.stringify(config))
                .then(async () => {
                    console.log(`${(await i18n()).autoEnterChat}${(await i18n())[autoInChat]}`)
                    choose()
                })
                .catch((err) => console.error('Error writing to file:', err))
        } else if (answer === '/back' || answer === '/choose') {
            choose()
        }
    })
}

async function init() {
    console.log(await file(path.resolve(__dirname, 'logo')).text())
    console.log('\n')
    console.log(`uyou llm console v${packageJSON.version} -- by Anthony Lu\n`);

    file(path.resolve(__dirname, 'config.json'))
        .json()
        .then(async (config) => {
            ollama = new Ollama({ host: config.apiLink })

            if (config.autoInChat === 'on') {
                const models = await (await ollama.list()).models
                console.log(`${(await i18n()).startChat} (${(await i18n()).model}${config.model ? config.model : models[0].model})`)
                
                if (config.systemPrompt) {
                    const systemPrompt = config.systemPrompt
                    console.log(`\n${(await i18n()).system}${systemPrompt}`);   
                }
                chat()
                return
            }

            choose()
        })
        .catch((_err) => {
            setApi()            
        })
}

init()

rl.on('close', () => {
    process.exit()
})
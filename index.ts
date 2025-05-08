import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path'
import { Ollama, type Message } from 'ollama'
import i18n from './i18n'

interface Config {
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
            const config = JSON.parse(await fs.promises.readFile(path.resolve(__dirname, 'config.json'), 'utf-8'))
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
        fs.writeFile(path.resolve(__dirname, 'config.json'), JSON.stringify(config), async (err) => {
            if (err) {
                console.error('Error writing to file:', err)
                return
            }
            console.log((await i18n()).setApiSuccess)
            init()
            choose()
        })
    })
}

async function setModel() {
    const modelList = await (await ollama.list()).models
    const question = modelList.map((model, index) => `${index + 1}: ${model.model}`).join('\n')
    rl.question(`${(await i18n()).chooseModel}\n${question}\n`, (answer) => {
        fs.readFile(path.resolve(__dirname, 'config.json'), 'utf-8', async (err, data) => {
            if (err) {
                console.error('Error reading file:', err)
                return
            }
            const config = JSON.parse(data)
            const modelIndex = parseInt(answer.trim()) - 1
            if (modelIndex < 0 || modelIndex >= modelList.length) {
                console.log((await i18n()).invalidInput)
                setModel()
                return
            }
            config.model = modelList[modelIndex].model
            fs.writeFile(path.resolve(__dirname, 'config.json'), JSON.stringify(config), async (err) => {
                if (err) {
                    console.error('Error writing to file:', err)
                    return
                }
                console.log((await i18n()).setModelSuccess)
                choose()
            })
        })
    })
}

async function setSystemPrompt() {
    rl.question((await i18n()).setSystemPrompt, (answer) => {
        fs.readFile(path.resolve(__dirname, 'config.json'), 'utf-8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err)
                return
            }
            const config = JSON.parse(data)
            config.systemPrompt = answer.trim()
            fs.writeFile(path.resolve(__dirname, 'config.json'), JSON.stringify(config), async (err) => {
                if (err) {
                    console.error('Error writing to file:', err)
                    return
                }
                console.log((await i18n()).setSystemPromptSuccess)
                choose()
            })
        })
    })
}

const chatList: Message[] = []

async function chat() {
    const config = JSON.parse(await fs.promises.readFile(path.resolve(__dirname, 'config.json'), 'utf-8'))
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
    const config: Config = JSON.parse(await fs.promises.readFile(path.resolve(__dirname, 'config.json'), 'utf-8'))

    rl.question(`${(await i18n()).otherSettings}(${config.autoInChat ? (await i18n())[config.autoInChat] : (await i18n()).off})\n`, async (answer) => {
        if (answer === '1') {
            const autoInChat = config.autoInChat === 'on' ? 'off' : 'on'
            config.autoInChat = autoInChat
            fs.writeFile(path.resolve(__dirname, 'config.json'), JSON.stringify(config), async (err) => {
                if (err) {
                    console.error('Error writing to file:', err)
                    return
                }
                console.log(`${(await i18n()).autoEnterChat}${(await i18n())[autoInChat]}`)
                choose()
            })
        } else if (answer === '/back' || answer === '/choose') {
            choose()
        }
    })
}

function init() {
    fs.readFile(path.resolve(__dirname, 'config.json'), 'utf-8', async (err, _data) => {
        if (err) {
            setApi()
            return
        }
        const config = fs.readFileSync(path.resolve(__dirname, 'config.json'), 'utf-8')
        ollama = new Ollama({ host: JSON.parse(config).apiLink })

        if (JSON.parse(config).autoInChat === 'on') {
            const config = JSON.parse(await fs.promises.readFile(path.resolve(__dirname, 'config.json'), 'utf-8'))
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
}

init()

rl.on('close', () => {
    process.exit()
})
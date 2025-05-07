import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path';
import { Ollama, type Message } from 'ollama'

let ollama: Ollama

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function choose() {
    rl.question('Choose: \n1: set Model\n2: set Api\n3: set System Prompt\n4: To chat\n5: settings\n', async (answer) => {
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
            console.log(`\nStart to chat (model: ${config.model ? config.model : models[0].model})`)
            
            if (config.systemPrompt) {
                const systemPrompt = config.systemPrompt
                console.log(`\nSystem: ${systemPrompt}`);   
            }
            chat()
        } else {
            settings()
        }
    })
}

function setApi() {
    rl.question('Please enter your api link:\n', (answer) => {
        const apiLink = answer.trim()
        if (!apiLink) {
            console.log('Invalid input. Please try again.')
            setApi()
            return
        }
        const config = {
            apiLink: apiLink
        }
        fs.writeFile(path.resolve(__dirname, 'config.json'), JSON.stringify(config), (err) => {
            if (err) {
                console.error('Error writing to file:', err)
                return
            }
            console.log('API link saved successfully.')
            init()
            choose()
        })
    })
}

async function setModel() {
    const modelList = await (await ollama.list()).models
    const question = modelList.map((model, index) => `${index + 1}: ${model.model}`).join('\n')
    rl.question(`Please choose your model:\n${question}\n`, (answer) => {
        fs.readFile(path.resolve(__dirname, 'config.json'), 'utf-8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err)
                return
            }
            const config = JSON.parse(data)
            const modelIndex = parseInt(answer.trim()) - 1
            if (modelIndex < 0 || modelIndex >= modelList.length) {
                console.log('Invalid input. Please try again.')
                setModel()
                return
            }
            config.model = modelList[modelIndex].model
            fs.writeFile(path.resolve(__dirname, 'config.json'), JSON.stringify(config), (err) => {
                if (err) {
                    console.error('Error writing to file:', err)
                    return
                }
                console.log('Model saved successfully.')
                choose()
            })
        })
    })
}

function setSystemPrompt() {
    rl.question('Please enter your system prompt:\n', (answer) => {
        fs.readFile(path.resolve(__dirname, 'config.json'), 'utf-8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err)
                return
            }
            const config = JSON.parse(data)
            config.systemPrompt = answer.trim()
            fs.writeFile(path.resolve(__dirname, 'config.json'), JSON.stringify(config), (err) => {
                if (err) {
                    console.error('Error writing to file:', err)
                    return
                }
                console.log('System prompt saved successfully.')
                choose()
            })
        })
    })
}

const chatList: Message[] = []

async function chat() {
    const config = JSON.parse(await fs.promises.readFile(path.resolve(__dirname, 'config.json'), 'utf-8'))
    const models = await (await ollama.list()).models

    rl.question('You: ', async (input) => {
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
        console.log('Bot:')
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
    const config = JSON.parse(await fs.promises.readFile(path.resolve(__dirname, 'config.json'), 'utf-8'))

    rl.question(`uyou llm console settings:\n1: set automatically enter chat on startup (${config.autoInChat ? config.autoInChat : 'off'})\n`, (answer) => {
        if (answer === '1') {
            const autoInChat = config.autoInChat === 'on' ? 'off' : 'on'
            config.autoInChat = autoInChat
            fs.writeFile(path.resolve(__dirname, 'config.json'), JSON.stringify(config), (err) => {
                if (err) {
                    console.error('Error writing to file:', err)
                    return
                }
                console.log(`Auto enter chat on startup is now ${autoInChat}.`)
                choose()
            })
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
            console.log(`Start to chat (model: ${config.model ? config.model : models[0].model})`)
            
            if (config.systemPrompt) {
                const systemPrompt = config.systemPrompt
                console.log(`\nSystem: ${systemPrompt}`);   
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
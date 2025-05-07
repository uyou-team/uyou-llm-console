import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path';
import { Ollama } from 'ollama'

let ollama: Ollama

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function choose() {
    rl.question('Choose: \n1: set Model\n2: set Api\n3: set System Prompt\n4: To chat\n', async (answer) => {
        if (answer === '1') {
            setModel()
        } else if (answer === '2') {
            setApi()
        } else if (answer === '3') {
            setSystemPrompt()
        } else if (answer === '/exit'.toLowerCase()) {
            rl.close()
        } else {
            const config = JSON.parse(await fs.promises.readFile(path.resolve(__dirname, 'config.json'), 'utf-8'))
            const models = await (await ollama.list()).models
            console.log(`Start to chat (model: ${config.model ? config.model : models[0].model})`)
            chat()
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

async function chat() {
    const config = JSON.parse(await fs.promises.readFile(path.resolve(__dirname, 'config.json'), 'utf-8'))
    const models = await (await ollama.list()).models

    if (config.systemPrompt) {
        const systemPrompt = config.systemPrompt
        console.log(`System: ${systemPrompt}`);   
    }

    rl.question('You: ', async (input) => {
        if (input.toLowerCase() === '/exit') {
            rl.close()
            return
        }
        if (input.toLowerCase() === '/back' || input.toLowerCase() === '/choose') {
            choose()
            return
        }
        const response = await ollama.chat({
            model: config.model ? config.model : models[0].model,
            messages: [{role: 'system', content: config.systemPrompt}, { role: 'user', content: input }],
            stream: true
        })
        console.log('Bot:')
        for await (const part of response) {
            process.stdout.write(part.message.content)
        }
        console.log('\n')
        chat()
    })
}

function init() {
    fs.readFile(path.resolve(__dirname, 'config.json'), 'utf-8', (err, _data) => {
        if (err) {
            setApi()
            return
        }
        const config = fs.readFileSync(path.resolve(__dirname, 'config.json'), 'utf-8')
        ollama = new Ollama({ host: JSON.parse(config).apiLink })
    
        choose()
    })
}

init()

rl.on('close', () => {
    process.exit()
})
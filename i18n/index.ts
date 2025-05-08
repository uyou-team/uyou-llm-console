import { osLocale } from 'os-locale'
import en from './en.json'
import zhHans from './zh-hans.json'

export default async function () {
    if (await osLocale() === 'zh-CN') {
        return zhHans
    } else {
        return en
    }
}
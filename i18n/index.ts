import { osLocaleSync } from 'os-locale'
import en from './en.json'
import zhHans from './zh-hans.json'

export default function () {
    if (osLocaleSync().toLowerCase() === 'zh-cn') {
        return zhHans
    } else {
        return en
    }
}
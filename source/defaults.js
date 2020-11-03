// builtin
import { env } from 'process'

export const npmAuthToken = env.NPM_AUTHTOKEN
export const travisEmail = env.TRAVIS_NOTIFICATION_EMAIL
export const travisComToken = env.TRAVIS_COM_TOKEN
export const travisOrgToken = env.TRAVIS_ORG_TOKEN
export const bevryCDNToken = env.BEVRY_CDN_TOKEN
export const surgeLogin = env.SURGE_LOGIN
export const surgeToken = env.SURGE_TOKEN
export const vercelToken = env.VERCEL_TOKEN || env.NOW_TOKEN

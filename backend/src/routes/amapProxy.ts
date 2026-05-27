import { Router } from 'express'
import { sendError } from '../utils/apiResponse'

const amapProxyRouter = Router()

function getAmapJsSecurityCode() {
  return process.env.AMAP_JS_SECURITY_CODE?.trim()
}

function buildAmapProxyUrl(originalUrl: string, securityCode: string) {
  const upstreamPath = originalUrl.replace(/^\/_AMapService/, '') || '/'
  const upstreamUrl = new URL(upstreamPath, 'https://restapi.amap.com')

  upstreamUrl.searchParams.set('jscode', securityCode)

  return upstreamUrl
}

amapProxyRouter.use(async (request, response) => {
  const securityCode = getAmapJsSecurityCode()

  if (!securityCode) {
    return sendError(response, 503, '未配置高德地图 JS 安全密钥')
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    return sendError(response, 405, '高德地图代理仅支持 GET 请求')
  }

  const upstreamUrl = buildAmapProxyUrl(request.originalUrl, securityCode)

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
    })
    const contentType = upstreamResponse.headers.get('content-type')
    const cacheControl = upstreamResponse.headers.get('cache-control')
    const body = Buffer.from(await upstreamResponse.arrayBuffer())

    if (contentType) {
      response.setHeader('content-type', contentType)
    }

    if (cacheControl) {
      response.setHeader('cache-control', cacheControl)
    }

    return response.status(upstreamResponse.status).send(body)
  } catch (error) {
    console.error(error)
    return sendError(response, 502, '高德地图代理请求失败')
  }
})

export { amapProxyRouter }

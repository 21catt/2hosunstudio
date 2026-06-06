import { supabaseAdmin } from './supabaseAdmin'

const TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const MEMO_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'

// refresh_token으로 access_token 갱신 후 저장
async function refreshAccessToken(row) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.KAKAO_REST_API_KEY,
      client_secret: process.env.KAKAO_CLIENT_SECRET,
      refresh_token: row.refresh_token,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('토큰 갱신 실패: ' + JSON.stringify(data))

  const update = {
    access_token: data.access_token,
    access_expires_at: new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (data.refresh_token) update.refresh_token = data.refresh_token // 갱신본 오면 교체

  // 콜백이 kakao_id 기준으로 저장하므로 kakao_id로 갱신 (id 컬럼 유무와 무관하게 안전)
  await supabaseAdmin.from('admin_kakao_tokens').update(update).eq('kakao_id', row.kakao_id)
  return data.access_token
}

async function getValidAccessToken(row) {
  if (new Date(row.access_expires_at).getTime() > Date.now()) return row.access_token
  return await refreshAccessToken(row)
}

// 저장된 모든 관리자에게 "나에게 보내기"
export async function sendMemoToAdmins(text, linkUrl) {
  const { data: rows, error } = await supabaseAdmin.from('admin_kakao_tokens').select('*')
  if (error) throw error
  if (!rows?.length) return { sent: 0, total: 0 }

  const templateObject = {
    object_type: 'text',
    text,
    link: { web_url: linkUrl, mobile_web_url: linkUrl },
  }

  let sent = 0
  for (const row of rows) {
    try {
      const accessToken = await getValidAccessToken(row)
      const res = await fetch(MEMO_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        body: 'template_object=' + encodeURIComponent(JSON.stringify(templateObject)),
      })
      const result = await res.json()
      if (result.result_code === 0) sent++
      else console.error('카카오 발송 실패', row.nickname, result)
    } catch (e) {
      console.error('카카오 발송 오류', row.nickname, e)
    }
  }
  return { sent, total: rows.length }
}
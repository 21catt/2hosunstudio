import { supabase } from './supabase'

// 미니게임 점수 제출 — 본인 최고점만 갱신(더 높을 때만). game = 'colormix' | 'colortetris'
export async function submitGameScore(game, score) {
  try {
    if (!score || score <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const name = user.user_metadata?.name || '냥작가'
    const { data: ex } = await supabase.from('game_scores').select('score').eq('game', game).eq('user_id', user.id).maybeSingle()
    if (ex && ex.score >= score) return
    await supabase.from('game_scores').upsert(
      { game, user_id: user.id, name, score, updated_at: new Date().toISOString() },
      { onConflict: 'game,user_id' }
    )
  } catch {}
}

// 게임별 상위 N (이름·점수). 테이블/권한 없으면 조용히 빈 배열.
export async function topGameScores(game, limit = 3) {
  try {
    const { data } = await supabase.from('game_scores')
      .select('name, score, user_id')
      .eq('game', game)
      .order('score', { ascending: false })
      .limit(limit)
    return data || []
  } catch { return [] }
}

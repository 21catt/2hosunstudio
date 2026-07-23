// 업로드 전 이미지 최적화 — 원본 대용량 사진(스마트폰 3~5MB)을 디지털 열람용으로
// 리사이즈 + JPEG 재인코딩해 용량·로딩을 줄인다. 실패 시 원본 그대로 반환(안전).
//
// maxDim: 긴 변 최대 px(레티나 열람 충분), quality: JPEG 품질(0~1).

export async function compressImage(file, { maxDim = 1600, quality = 0.82 } = {}) {
  if (typeof document === 'undefined') return file
  if (!file || !file.type?.startsWith('image/')) return file
  if (file.type === 'image/gif') return file // 애니메이션 GIF는 굽지 않음(1프레임화 방지)

  try {
    const bitmap = await loadBitmap(file)
    const sw = bitmap.width, sh = bitmap.height
    if (!sw || !sh) { closeBitmap(bitmap); return file }

    const scale = Math.min(1, maxDim / Math.max(sw, sh))
    const w = Math.max(1, Math.round(sw * scale))
    const h = Math.max(1, Math.round(sh * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { closeBitmap(bitmap); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    closeBitmap(bitmap)

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file // 오히려 커지면(작은 사진 등) 원본 유지

    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}

function closeBitmap(b) { try { b.close && b.close() } catch {} }

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    // EXIF 회전 반영(지원 브라우저). 미지원이면 옵션 없이 재시도.
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch {}
    try { return await createImageBitmap(file) } catch {}
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = e => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

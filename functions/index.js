// 댓글이 달리면 그 사람 폰으로 알림을 보낸다.
//
// - 목사님이 아이 제출물에 댓글·답글을 달면  → 그 아이에게
// - 아이가 자기 제출물에 댓글·답글을 달면    → 목사님에게
//
// 토큰은 discipleTokens/{userId} 문서의 tokens 배열에 담긴다.
// 아이가 폰에서 '알림 받기'를 누른 순간 앱이 거기에 넣어 준다.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 5 });

const MANAGER = 't1';                 // 황영환 목사
const LABEL = { qt: '큐티', dqt: 'D형 큐티', sermon: '설교 노트', pray: '기도 영적일지' };
const SITE = 'https://wangbow2.github.io/hwakma/';

// 댓글 한 벌을 (댓글 + 대댓글) 납작하게 편다.
function flatten(msgs) {
  const out = [];
  (Array.isArray(msgs) ? msgs : []).forEach(m => {
    if (m && m.at) out.push(m);
    (Array.isArray(m && m.replies) ? m.replies : []).forEach(r => { if (r && r.at) out.push(r); });
  });
  return out;
}

exports.notifyOnNote = onDocumentWritten('discipleDocs/{docId}', async event => {
  const id = event.params.docId;
  if (!id.startsWith('note_')) return;

  const before = event.data.before.exists ? event.data.before.data() : null;
  const after  = event.data.after.exists ? event.data.after.data() : null;
  if (!after) return;

  // 이번에 새로 붙은 글만 고른다. 지우거나 고친 것은 알리지 않는다.
  const had = new Set(flatten(before && before.msgs).map(m => `${m.by}|${m.at}`));
  const fresh = flatten(after.msgs).filter(m => !had.has(`${m.by}|${m.at}`));
  if (!fresh.length) return;

  const target = after.target || 'sermon';
  const studentId = after.studentId;

  // 한 번에 여러 개가 붙는 일은 드물다. 가장 나중 것 하나로 알린다.
  const m = fresh[fresh.length - 1];
  const toUser = m.leader ? studentId : MANAGER;
  if (!toUser || toUser === m.by) return;

  const snap = await admin.firestore().collection('discipleTokens').doc(toUser).get();
  const tokens = snap.exists && Array.isArray(snap.data().tokens) ? snap.data().tokens : [];
  if (!tokens.length) return;

  const title = m.leader
    ? `${m.name || '목사님'}이 댓글을 남겼어요`
    : `${m.name || '누군가'} · ${LABEL[target] || target}`;
  const body = String(m.text || '').slice(0, 120);

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    data: { title, body, tag: `${target}_${studentId}_${after.date}`, url: SITE },
    webpush: {
      fcmOptions: { link: SITE },
      headers: { Urgency: 'high', TTL: '86400' }
    }
  });

  // 죽은 토큰은 걷어낸다 — 폰을 바꾸거나 앱을 지운 아이들 것이다.
  const dead = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument') dead.push(tokens[i]);
  });
  if (dead.length) {
    await snap.ref.update({
      tokens: admin.firestore.FieldValue.arrayRemove(...dead)
    });
  }
});

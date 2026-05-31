'use client';

import { useEffect, useMemo, useState } from 'react';
import DEFAULT_DATA from '../data/sounds.json';

export default function PronunciationApp({ initialSlug }) {
  const [DATA, setDATA] = useState(DEFAULT_DATA);
  const [selectedId, setSelectedId] = useState(DEFAULT_DATA[0].id);
  const [filter, setFilter] = useState('all');
  const [mode, setMode] = useState('words');
  const [selectedText, setSelectedText] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState(null);
  const [soundEditorOpen, setSoundEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('speakproEditableDataV5');
    if (saved) {
      try { setDATA(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    const bySlug = DATA.find(s => s.slug === initialSlug || s.id === initialSlug);
    if (bySlug) setSelectedId(bySlug.id);
  }, [DATA, initialSlug]);

  const current = useMemo(() => DATA.find(x => x.id === selectedId) || DATA[0], [DATA, selectedId]);

  const saveData = (next) => {
    setDATA(next);
    localStorage.setItem('speakproEditableDataV5', JSON.stringify(next));
  };

  const filtered = DATA
    .filter(s => filter === 'all' || s.category === filter)
    .filter(s => {
      const q = clean(search);
      if (!q) return true;
      return clean(s.symbol + ' ' + s.title + ' ' + s.group + ' ' + (s.words || []).map(w => w.text).join(' ')).includes(q);
    });

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/sound/${current.slug || current.id}`
    : `/sound/${current.slug || current.id}`;

  function selectSound(s) {
    setSelectedId(s.id);
    setSelectedText('');
    setSoundEditorOpen(false);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `/sound/${s.slug || s.id}`);
  }

  function speak(text) {
    if (!window.speechSynthesis) {
      alert('Trình duyệt chưa hỗ trợ phát âm.');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.72;
    u.pitch = 1.02;
    const voices = speechSynthesis.getVoices();
    const us = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en-us'));
    const pick = ['aria','jenny','samantha','zira','google us english','microsoft']
      .map(p => us.find(v => (v.name || '').toLowerCase().includes(p)))
      .find(Boolean) || us[0] || voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
    if (pick) u.voice = pick;
    speechSynthesis.speak(u);
  }

  function currentDefault() {
    return selectedText || current.words?.[0]?.text || current.soundSample || current.title;
  }

  function checkTarget(target) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Trình duyệt chưa hỗ trợ nhận diện giọng nói. Hãy dùng Chrome hoặc Edge.');
      return;
    }
    setResult({ listening: true });
    const r = new SR();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = e => showResult(target, e.results[0][0].transcript);
    r.onerror = () => setResult({ error: 'Không nghe được. Hãy kiểm tra quyền micro.' });
    r.start();
  }

  function showResult(target, spoken) {
    const t = clean(target).split(' ').filter(Boolean);
    const h = clean(spoken).split(' ').filter(Boolean);
    const details = t.map((w, i) => ({ target: w, heard: h[i] || '', score: sim(w, h[i] || '') }));
    const total = details.length ? Math.round(details.reduce((a, b) => a + b.score, 0) / details.length) : 0;
    setResult({ target, spoken, details, total });
  }

  function nextSound() {
    const i = DATA.findIndex(x => x.id === selectedId);
    selectSound(DATA[(i + 1) % DATA.length]);
  }

  function arrForMode(sound = current) {
    if (mode === 'words') return sound.words;
    if (mode === 'phrases') return sound.phrases;
    if (mode === 'sentences') return sound.sentences;
    return sound.minimalPairs;
  }

  function updateCurrent(mutator) {
    const next = DATA.map(s => {
      if (s.id !== current.id) return s;
      const copy = structuredClone(s);
      mutator(copy);
      return copy;
    });
    saveData(next);
  }

  function addItem() {
    updateCurrent(s => {
      if (mode === 'words') s.words.push({ text: 'new word', ipa: '/new/', pos: 'word', meaning: 'nghĩa mới' });
      if (mode === 'phrases') s.phrases.push({ text: 'new phrase', ipa: '/new phrase/', meaning: 'nghĩa mới' });
      if (mode === 'sentences') s.sentences.push({ text: 'New sentence.', ipa: '/new sentence/', meaning: 'nghĩa mới' });
      if (mode === 'pairs') s.minimalPairs.push({ left: 'word 1', right: 'word 2', leftMeaning: 'nghĩa 1', rightMeaning: 'nghĩa 2' });
    });
  }

  function deleteItem(index) {
    if (!confirm('Xóa mục này?')) return;
    updateCurrent(s => arrForMode(s).splice(index, 1));
  }

  function saveItem(index, item) {
    updateCurrent(s => { arrForMode(s)[index] = item; });
    setEditingItem(null);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'speakpro-data-edited.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function resetData() {
    if (!confirm('Khôi phục dữ liệu gốc? Các chỉnh sửa đã lưu sẽ mất.')) return;
    localStorage.removeItem('speakproEditableDataV5');
    setDATA(DEFAULT_DATA);
    setSelectedId(DEFAULT_DATA[0].id);
  }

  function copyShareLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => alert('Đã copy link âm này.'));
  }

  function saveSound(fields) {
    updateCurrent(s => Object.assign(s, fields));
    setSoundEditorOpen(false);
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="logo">SpeakPro Web</div>
        <h1>44 English Sounds</h1>
        <p>Website có URL riêng từng âm, dùng được trên Chrome sau khi deploy.</p>
        <div className="stats">{DATA.length} âm • {DATA.reduce((a,b)=>a+b.words.length,0)} từ • {DATA.reduce((a,b)=>a+b.phrases.length,0)} cụm • {DATA.reduce((a,b)=>a+b.sentences.length,0)} câu</div>
        <input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm âm, từ, IPA..." />
        <div id="shareBox">
          <div style={{fontWeight:1000, marginBottom:8}}>Link riêng của âm đang mở</div>
          <input id="shareLink" readOnly value={shareUrl} />
          <button onClick={copyShareLink} style={{marginTop:8,width:'100%',background:'white',color:'#0f172a'}}>Copy link gửi học viên</button>
        </div>
        <div id="adminBox">
          <div style={{fontWeight:1000, marginBottom:8}}>Quản trị nội dung</div>
          <button onClick={()=>setAdminMode(v=>!v)} style={{width:'100%',background:'#f97316',color:'white'}}>Bật/Tắt chế độ sửa</button>
          <button onClick={exportData} style={{width:'100%',marginTop:8,background:'white',color:'#0f172a'}}>Xuất dữ liệu JSON</button>
          <button onClick={resetData} style={{width:'100%',marginTop:8,background:'#ef4444',color:'white'}}>Khôi phục dữ liệu gốc</button>
        </div>
        <div className="tabs">
          {['all','vowel','consonant'].map(f => (
            <button key={f} className={`tab ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>
              {f==='all'?'Tất cả':f==='vowel'?'Nguyên âm':'Phụ âm'}
            </button>
          ))}
        </div>
        <div className="list">
          {filtered.map(s => (
            <button key={s.id} className={`sound ${s.id===selectedId?'active':''}`} onClick={()=>selectSound(s)}>
              <b>{s.symbol}</b>
              <div>{s.words.length} từ • {s.phrases.length} cụm • {s.sentences.length} câu</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="header">
          <div>
            <h2>Pronunciation Trainer {adminMode && <span className="editBadge">ADMIN EDIT ON</span>}</h2>
            <p>URL riêng từng âm: /sound/{current.slug}</p>
          </div>
          <div className="voice">🔊 Voice: Standard American English</div>
        </div>

        <section className="card hero">
          <span className="badge">{current.category === 'vowel' ? 'Nguyên âm' : 'Phụ âm'}</span>
          <span className="badge">{current.group}</span>
          <h1 className="symbol">{current.symbol}</h1>
          <div className="title">{current.title}</div>
          <div className="guide">{current.guide}</div>
          <div className="actions">
            <button className="primary" onClick={()=>speak(current.soundSample || current.words?.[0]?.text || current.title)}>🔊 Nghe âm IPA</button>
            <button className="dark" onClick={()=>speak(currentDefault())}>🔊 Nghe mẫu</button>
            <button className="greenbtn" onClick={()=>checkTarget(currentDefault())}>🎤 Kiểm tra</button>
            <button className="soft" onClick={nextSound}>Âm tiếp theo →</button>
            {adminMode && <button className="orangebtn" onClick={()=>setSoundEditorOpen(true)}>✏️ Sửa âm này</button>}
          </div>
          {soundEditorOpen && <SoundEditor sound={current} onSave={saveSound} onClose={()=>setSoundEditorOpen(false)} />}
        </section>

        <div className="resultGrid">
          <section>
            <div className="card">
              <div className="modebar">
                {[
                  ['words','Từ đơn'],
                  ['phrases','Cụm từ'],
                  ['sentences','Câu'],
                  ['pairs','Minimal Pairs']
                ].map(([m,label]) => (
                  <button key={m} className={`mode ${mode===m?'active':''}`} onClick={()=>{setMode(m); setEditingItem(null);}}>{label}</button>
                ))}
                {adminMode && <button className="greenbtn" onClick={addItem}>+ Thêm mục</button>}
              </div>
              <Items
                mode={mode}
                current={current}
                speak={speak}
                checkTarget={checkTarget}
                adminMode={adminMode}
                editingItem={editingItem}
                setEditingItem={setEditingItem}
                saveItem={saveItem}
                deleteItem={deleteItem}
              />
            </div>
          </section>

          <aside className="card">
            <h3 style={{marginTop:0}}>Kết quả kiểm tra</h3>
            <Result result={result} />
            <p className="note">Sau khi deploy, học viên có thể mở trực tiếp từng âm bằng URL /sound/long-i, /sound/p...</p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Items({ mode, current, speak, checkTarget, adminMode, editingItem, setEditingItem, saveItem, deleteItem }) {
  const arr = mode === 'words' ? current.words : mode === 'phrases' ? current.phrases : mode === 'sentences' ? current.sentences : current.minimalPairs;
  if (!arr.length) return <div className="empty">Chưa có dữ liệu cho mục này.</div>;
  return arr.map((item, index) => (
    <div key={index}>
      {mode === 'pairs' ? (
        <div className="pair">
          <div><b>{item.left}</b><div className="meaning">{item.leftMeaning}</div><button className="primary small" onClick={()=>speak(item.left)}>Nghe</button></div>
          <div className="vs">VS</div>
          <div><b>{item.right}</b><div className="meaning">{item.rightMeaning}</div><button className="primary small" onClick={()=>speak(item.right)}>Nghe</button></div>
          {adminMode && <div className="itemActions"><button className="orangebtn small" onClick={()=>setEditingItem(index)}>✏️ Sửa</button><button className="redbtn small" onClick={()=>deleteItem(index)}>🗑 Xóa</button></div>}
        </div>
      ) : (
        <div className="item">
          <div>{renderItem(mode, item)}</div>
          <div className="itemActions">
            <button className="primary small" onClick={()=>speak(item.text)}>Nghe</button>
            <button className="greenbtn small" onClick={()=>checkTarget(item.text)}>Kiểm tra</button>
            {adminMode && <button className="orangebtn small" onClick={()=>setEditingItem(index)}>✏️ Sửa</button>}
            {adminMode && <button className="redbtn small" onClick={()=>deleteItem(index)}>🗑 Xóa</button>}
          </div>
        </div>
      )}
      {editingItem === index && <ItemEditor mode={mode} item={item} onSave={(next)=>saveItem(index,next)} onCancel={()=>setEditingItem(null)} />}
    </div>
  ));
}

function renderItem(mode, item) {
  if (mode === 'words') return <div className="wordForm">{item.text} / <span className="ipaLine">{item.ipa || `/${item.text}/`}</span> / ({item.pos || 'word'}): <span className="meaning">{item.meaning || 'đang cập nhật nghĩa'}</span></div>;
  if (mode === 'phrases') return <div className="phraseForm"><b>{item.text}</b> : <span className="meaning">{item.meaning || 'đang cập nhật nghĩa'}</span><div className="ipaLine">{item.ipa}</div></div>;
  return <div className="sentenceForm"><b>Câu:</b><br />{item.text}<div className="ipaLine">{item.ipa}</div><div className="meaning">{item.meaning || 'đang cập nhật nghĩa'}</div></div>;
}

function ItemEditor({ mode, item, onSave, onCancel }) {
  const [draft, setDraft] = useState(item);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  return (
    <div className="adminPanel active">
      {mode === 'pairs' ? (
        <div className="formGrid">
          <Field label="Từ 1" value={draft.left || ''} onChange={v=>set('left',v)} />
          <Field label="Từ 2" value={draft.right || ''} onChange={v=>set('right',v)} />
          <Field label="Nghĩa từ 1" value={draft.leftMeaning || ''} onChange={v=>set('leftMeaning',v)} />
          <Field label="Nghĩa từ 2" value={draft.rightMeaning || ''} onChange={v=>set('rightMeaning',v)} />
        </div>
      ) : (
        <>
          <Field label={mode==='sentences'?'Câu':mode==='phrases'?'Cụm từ':'Từ'} value={draft.text || ''} onChange={v=>set('text',v)} textarea={mode==='sentences'} />
          <Field label="IPA" value={draft.ipa || ''} onChange={v=>set('ipa',v)} />
          {mode === 'words' && <Field label="Từ loại" value={draft.pos || ''} onChange={v=>set('pos',v)} />}
          <Field label="Nghĩa tiếng Việt" value={draft.meaning || ''} onChange={v=>set('meaning',v)} textarea={mode==='sentences'} />
        </>
      )}
      <div className="editTop">
        <button className="greenbtn" onClick={()=>onSave(draft)}>Lưu</button>
        <button className="soft" onClick={onCancel}>Hủy</button>
      </div>
    </div>
  );
}

function SoundEditor({ sound, onSave, onClose }) {
  const [draft, setDraft] = useState({
    symbol: sound.symbol, title: sound.title, group: sound.group, soundSample: sound.soundSample || '', guide: sound.guide
  });
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  return (
    <div className="adminPanel active">
      <div className="adminHint">Sửa thông tin tổng quan của âm hiện tại rồi bấm Lưu.</div>
      <div className="formGrid">
        <Field label="Ký hiệu âm" value={draft.symbol} onChange={v=>set('symbol',v)} />
        <Field label="Tên bài" value={draft.title} onChange={v=>set('title',v)} />
        <Field label="Nhóm" value={draft.group} onChange={v=>set('group',v)} />
        <Field label="Âm mẫu để TTS đọc" value={draft.soundSample} onChange={v=>set('soundSample',v)} />
      </div>
      <Field label="Hướng dẫn phát âm" value={draft.guide} onChange={v=>set('guide',v)} textarea />
      <div className="editTop">
        <button className="greenbtn" onClick={()=>onSave(draft)}>Lưu âm này</button>
        <button className="soft" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea }) {
  return (
    <div className="field">
      <label>{label}</label>
      {textarea ? <textarea className="edit" value={value} onChange={e=>onChange(e.target.value)} /> : <input className="edit" value={value} onChange={e=>onChange(e.target.value)} />}
    </div>
  );
}

function Result({ result }) {
  if (!result) return <div className="empty">Chọn từ/cụm/câu rồi bấm kiểm tra.</div>;
  if (result.listening) return <div className="empty">🎤 Đang nghe...</div>;
  if (result.error) return <div className="empty">{result.error}</div>;
  return (
    <>
      <div className="score"><span>Tổng điểm</span><b>{result.total}</b><span>{label(result.total)}</span></div>
      <div className="heard"><b>Target:</b> {result.target}<br /><b>App nghe:</b> {result.spoken}</div>
      <div className="words">
        {result.details.map((d,i)=><div key={i} className={`wscore ${cls(d.score)}`}><div>{d.target}</div><div>{d.score}/100 - {label(d.score)}</div><div style={{fontSize:13}}>Nghe: {d.heard || '—'}</div></div>)}
      </div>
    </>
  );
}

function clean(t) {
  return (t || '').toLowerCase().replaceAll('’', "'").replace(/[^a-z0-9\\s']/g, ' ').replace(/\\s+/g, ' ').trim();
}
function editDistance(a,b){const m=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)m[i][0]=i;for(let j=0;j<=b.length;j++)m[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){const c=a[i-1]===b[j-1]?0:1;m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+c);}return m[a.length][b.length];}
function sim(a,b){if(!a||!b)return 0;if(a===b)return 100;return Math.max(0,Math.round((1-editDistance(a,b)/Math.max(a.length,b.length))*100));}
function cls(score){return score>=90?'ok':score>=70?'warn':'bad';}
function label(score){return score>=90?'Đúng':score>=70?'Sai nhẹ':'Sai nhiều';}

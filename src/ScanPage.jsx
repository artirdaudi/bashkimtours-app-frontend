import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, CheckCircle2, AlertTriangle, Volume2, VolumeX, Square, ScanLine } from 'lucide-react';
import { qrApi } from './api';
import { cardToken, createScanGate, scanStatus } from './scanUtils';
import { monthSq } from './locale';
import './scan.css';

const money = (value) => `${Number(value || 0).toFixed(2)} €`;

export default function ScanPage() {
  const video = useRef(null);
  const scanner = useRef(null);
  const audio = useRef(null);
  const muted = useRef(false);
  const request = useRef(null);
  const session = useRef(0);
  const [cameraState, setCameraState] = useState('idle');
  const [cameraError, setCameraError] = useState('');
  const [sound, setSound] = useState(true);
  const [soundError, setSoundError] = useState('');
  const [result, setResult] = useState(null);

  async function enableAudio() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error();
      if (!audio.current || audio.current.state === 'closed') audio.current = new Audio();
      await audio.current.resume();
      if (audio.current.state !== 'running') throw new Error();
      setSoundError('');
    } catch { setSoundError('Zëri nuk është aktiv. Prekni butonin e zërit për ta aktivizuar.'); }
  }

  useEffect(() => {
    let live = true;
    const accept = createScanGate();
    const tone = (kind) => {
      const context = audio.current;
      if (muted.current || !context || context.state !== 'running') return;
      const notes = kind === 'good' ? [660, 880] : kind === 'bad' ? [220, 160] : [440];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + index * 0.19;
        oscillator.type = kind === 'bad' ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.17);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start); oscillator.stop(start + 0.18);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    };
    const read = async ({ data }) => {
      if (!live || !accept(data)) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const token = cardToken(data);
      if (!token) {
        setResult({ error: 'Ky QR nuk është kartelë nxënësi e Bashkim Tours.' });
        tone('unknown');
        return;
      }
      setResult({ loading: true });
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        if (!navigator.onLine) throw new Error('Nuk ka internet. Kartela nuk mund të verifikohet.');
        const profile = await qrApi.profile(token, { signal: controller.signal });
        if (!live || request.current !== controller || controller.signal.aborted) return;
        const status = scanStatus(profile);
        setResult({ profile, status, at: new Date() });
        tone(status.kind);
      } catch (error) {
        if (!live || request.current !== controller) return;
        setResult({ error: controller.signal.aborted ? 'Verifikimi zgjati shumë. Largoni kartelën dhe provoni përsëri.' : error.message });
        tone('unknown');
      } finally { window.clearTimeout(timeout); }
    };
    const instance = new QrScanner(video.current, read, {
      preferredCamera: 'environment', maxScansPerSecond: 8,
      highlightScanRegion: true, highlightCodeOutline: true,
      returnDetailedScanResult: true,
    });
    scanner.current = instance;
    const clearResult = () => {
      if (document.hidden || !navigator.onLine) {
        request.current?.abort();
        request.current = null;
        setResult(null);
      }
    };
    document.addEventListener('visibilitychange', clearResult);
    window.addEventListener('offline', clearResult);
    return () => {
      live = false;
      session.current += 1;
      request.current?.abort(); request.current = null;
      instance.destroy(); scanner.current = null;
      audio.current?.close().catch(() => {}); audio.current = null;
      document.removeEventListener('visibilitychange', clearResult);
      window.removeEventListener('offline', clearResult);
    };
  }, []);

  async function start() {
    const version = ++session.current;
    setCameraState('starting'); setCameraError(''); setResult(null);
    if (!muted.current) void enableAudio();
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Kamera kërkon HTTPS dhe një shfletues që mbështet kamerën.');
      }
      await scanner.current.start();
      if (version === session.current) setCameraState('running');
    } catch (error) {
      if (version !== session.current) return;
      setCameraState('idle');
      setCameraError(error.message?.startsWith('Kamera kërkon') ? error.message : 'Kamera nuk u hap. Lejoni qasjen në kamerë te cilësimet e shfletuesit dhe provoni përsëri.');
    }
  }
  function stop() {
    session.current += 1;
    scanner.current?.stop();
    request.current?.abort(); request.current = null;
    setCameraState('idle'); setResult(null);
  }
  function toggleSound() {
    if (soundError) { muted.current = false; setSound(true); void enableAudio(); return; }
    muted.current = !muted.current; setSound(!muted.current);
    if (!muted.current) void enableAudio();
  }
  const profile = result?.profile;
  const status = result?.status;
  return (
    <div className="bt-page bt-scan-page">
      <header className="bt-page-header"><div><span className="bt-eyebrow">Maarif</span><h1>Skano</h1><p>Vendosni kartelën para kamerës. Kartela tjetër skanohet automatikisht.</p></div></header>
      <section className="bt-scan-camera-panel">
        <div className="bt-scan-video"><video ref={video} muted playsInline aria-label="Kamera për skanimin e kartelave" />{cameraState !== 'running' && <div className="bt-scan-placeholder"><ScanLine size={44} /><span>{cameraState === 'starting' ? 'Duke hapur kamerën…' : 'Gati për skanim'}</span></div>}</div>
        <div className="bt-scan-controls">
          {cameraState === 'running' ? <button className="bt-btn-primary" onClick={stop}><Square size={17} /> Ndalo kamerën</button> : <button className="bt-btn-primary" onClick={start} disabled={cameraState === 'starting'}><Camera size={18} /> Hap kamerën</button>}
          <button className="bt-scan-sound" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Çaktivizo zërin' : 'Aktivizo zërin'}>{sound ? <Volume2 /> : <VolumeX />}{sound ? 'Zëri aktiv' : 'Pa zë'}</button>
        </div>
        {cameraError && <p className="bt-inline-error" role="alert">{cameraError}</p>}
        {soundError && <p role="status">{soundError}</p>}
        <p className="bt-scan-hint">Për ta skanuar përsëri të njëjtën kartelë, largojeni nga kamera për 2 sekonda.</p>
      </section>
      <section className={`bt-scan-result ${status?.kind || ''}`} aria-live="polite" aria-atomic="true">
        {result?.loading ? <p>Duke verifikuar kartelën…</p> : result?.error ? <div className="bt-scan-result-heading"><AlertTriangle /><div><h2>Nuk u verifikua</h2><p>{result.error}</p></div></div> : profile ? <>
          <div className="bt-scan-result-heading">{status.kind === 'good' ? <CheckCircle2 /> : <AlertTriangle />}<div><h2>{status.title}</h2><p>{profile.transport_status_reason}</p></div></div>
          <div className="bt-scan-student"><span>BT{profile.student.student_code}</span><h2>{profile.student.first_name} {profile.student.last_name}</h2><p>{profile.student.area_name} · {profile.student.parent_name}</p></div>
          <dl><div><dt>Muaji aktual</dt><dd>{status.current ? `${monthSq(status.current.month, status.current.month_name)} ${status.current.calendar_year} · ${status.current.status === 'PAID' ? 'Paguar' : 'Pa paguar'}` : 'Nuk ka pagesë të konfirmuar për këtë muaj'}</dd></div><div><dt>Automjeti</dt><dd>{profile.current_transport ? `${profile.current_transport.plate_number} · ${profile.current_transport.model}` : 'Pa automjet'}</dd></div><div><dt>Verifikuar</dt><dd>{result.at.toLocaleTimeString('sq-AL')}</dd></div></dl>
          {status.unpaid.length > 0 && <div className="bt-scan-dues"><h3>Muajt e papaguar</h3>{status.unpaid.map((due) => <div key={due.due_id}><span>{monthSq(due.month, due.month_name)} {due.calendar_year}</span><strong>{money(due.amount_due)}</strong></div>)}</div>}
        </> : <div className="bt-scan-empty"><ScanLine /><p>Nxënësi i skanuar dhe gjendja e pagesave shfaqen këtu.</p></div>}
      </section>
    </div>
  );
}

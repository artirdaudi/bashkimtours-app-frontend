import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { CheckCircle2, AlertTriangle, ScanLine } from 'lucide-react';
import { qrApi } from './api';
import { cardToken, createScanGate, scanStatus } from './scanUtils';
import { monthSq } from './locale';
import './scan.css';
import { prepareScanAudio, playScanTone, releaseScanAudio } from './scanAudio';

const money = (value) => `${Number(value || 0).toFixed(2)} €`;

export default function ScanPage() {
  const video = useRef(null);
  const scanner = useRef(null);
  const request = useRef(null);
  const [cameraState, setCameraState] = useState('starting');
  const [cameraError, setCameraError] = useState('');
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let live = true;
    const accept = createScanGate();
    let audioContext;
    const syncAudioState = () => {
      if (live) setSoundBlocked(Boolean(audioContext && audioContext.state !== 'running'));
    };
    const unlockAudio = () => {
      audioContext = prepareScanAudio();
      if (audioContext) audioContext.onstatechange = syncAudioState;
      syncAudioState();
    };
    // A direct page launch may require a first touch under Safari autoplay rules.
    document.addEventListener('pointerup', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    const audioTimer = window.setTimeout(unlockAudio, 0);
    const read = async ({ data }) => {
      if (!live || !accept(data)) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const token = cardToken(data);
      if (!token) {
        setResult({ error: 'Ky QR nuk është kartelë nxënësi e Bashkim Tours.' });
        playScanTone('unknown');
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
        playScanTone(status.kind);
      } catch (error) {
        if (!live || request.current !== controller) return;
        setResult({ error: controller.signal.aborted ? 'Verifikimi zgjati shumë. Largoni kartelën dhe provoni përsëri.' : error.message });
        playScanTone('unknown');
      } finally { window.clearTimeout(timeout); }
    };
    const instance = new QrScanner(video.current, read, {
      preferredCamera: 'environment', maxScansPerSecond: 8,
      highlightScanRegion: true, highlightCodeOutline: true,
      returnDetailedScanResult: true,
    });
    scanner.current = instance;
    const startCamera = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('Kamera kërkon HTTPS dhe një shfletues që mbështet kamerën.');
        }
        await instance.start();
        if (live) setCameraState('running');
      } catch (error) {
        if (!live) return;
        setCameraState('error');
        setCameraError(error.message?.startsWith('Kamera kërkon') ? error.message : 'Lejoni qasjen në kamerë te cilësimet e shfletuesit dhe provoni përsëri.');
      }
    };
    void startCamera();
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
      request.current?.abort(); request.current = null;
      instance.destroy(); scanner.current = null;
      window.clearTimeout(audioTimer);
      if (audioContext) audioContext.onstatechange = null;
      releaseScanAudio();
      document.removeEventListener('pointerup', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('visibilitychange', clearResult);
      window.removeEventListener('offline', clearResult);
    };
  }, []);

  const profile = result?.profile;
  const status = result?.status;
  return (
    <div className="bt-page bt-scan-page">
      <header className="bt-scan-header"><h1>Skano</h1>{soundBlocked && <small role="status">Prekni ekranin një herë për zërin.</small>}</header>
      <div className="bt-scan-workspace">
      <section className="bt-scan-camera-panel" aria-label="Kamera">
        <div className="bt-scan-video"><video ref={video} muted playsInline autoPlay aria-label="Kamera për skanimin e kartelave" />{cameraState !== 'running' && <div className="bt-scan-placeholder"><ScanLine size={36} />{cameraError ? <><p role="alert">{cameraError}</p><button className="bt-btn-primary" onClick={() => window.location.reload()}>Provo përsëri</button></> : <span>Duke hapur kamerën…</span>}</div>}</div>
      </section>
      <section className={`bt-scan-result ${status?.kind || ''}`} aria-live="polite" aria-atomic="true">
        {result?.loading ? <p>Duke verifikuar kartelën…</p> : result?.error ? <div className="bt-scan-result-heading"><AlertTriangle /><div><h2>Nuk u verifikua</h2><p>{result.error}</p></div></div> : profile ? <>
          <div className="bt-scan-result-heading">{status.kind === 'good' ? <CheckCircle2 /> : <AlertTriangle />}<div><h2>{status.title}</h2><p>{profile.transport_status_reason}</p></div></div>
          <div className="bt-scan-student"><span>BT{profile.student.student_code}</span><h2>{profile.student.first_name} {profile.student.last_name}</h2><p>{profile.student.area_name} · {profile.student.parent_name}</p></div>
          <dl><div><dt>Muaji aktual</dt><dd>{status.current ? `${monthSq(status.current.month, status.current.month_name)} ${status.current.calendar_year} · ${status.current.status === 'PAID' ? 'Paguar' : 'Pa paguar'}` : 'Nuk ka pagesë të konfirmuar për këtë muaj'}</dd></div><div><dt>Automjeti</dt><dd>{profile.current_transport ? `${profile.current_transport.plate_number} · ${profile.current_transport.model}` : 'Pa automjet'}</dd></div><div><dt>Verifikuar</dt><dd>{result.at.toLocaleTimeString('sq-AL')}</dd></div></dl>
          {status.unpaid.length > 0 && <details className="bt-scan-dues"><summary>Muajt e papaguar ({status.unpaid.length}) · {money(status.unpaid.reduce((sum, due) => sum + Number(due.amount_due || 0), 0))}</summary>{status.unpaid.map((due) => <div key={due.due_id}><span>{monthSq(due.month, due.month_name)} {due.calendar_year}</span><strong>{money(due.amount_due)}</strong></div>)}</details>}
        </> : <div className="bt-scan-empty"><ScanLine /><p>Nxënësi i skanuar dhe gjendja e pagesave shfaqen këtu.</p></div>}
      </section>
      </div>
    </div>
  );
}

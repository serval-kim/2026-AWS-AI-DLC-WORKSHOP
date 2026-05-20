import React, { useState } from 'react';
import DisclaimerModal from './components/DisclaimerModal';
import UploadScene3D from './components/upload/UploadScene3D';
import AnalyzingPage from './components/AnalyzingPage';
import ResultPage from './components/ResultPage';

// Stages: 'disclaimer' → 'upload' → 'analyzing' → 'result'
export default function App() {
  const [stage, setStage] = useState('disclaimer');
  const [file, setFile] = useState(null);

  function handleAcceptDisclaimer() {
    setStage('upload');
  }

  function handleUpload(uploadedFile) {
    setFile(uploadedFile);
    setStage('analyzing');
  }

  function handleAnalysisComplete() {
    setStage('result');
  }

  function handleReset() {
    setFile(null);
    setStage('upload');
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#050810' }}>
      {stage === 'disclaimer' && (
        <DisclaimerModal onAccept={handleAcceptDisclaimer} />
      )}
      {stage === 'upload' && (
        <UploadScene3D onUpload={handleUpload} />
      )}
      {stage === 'analyzing' && (
        <AnalyzingPage file={file} onComplete={handleAnalysisComplete} />
      )}
      {stage === 'result' && (
        <ResultPage file={file} onReset={handleReset} />
      )}
    </div>
  );
}

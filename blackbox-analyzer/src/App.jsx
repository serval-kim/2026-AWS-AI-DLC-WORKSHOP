import { useState } from "react";
import DisclaimerModal from "./components/DisclaimerModal";
import UploadScene3D from "./components/upload/UploadScene3D";
import ResultPage from "./components/ResultPage";

// Stages: 'disclaimer' → 'upload' → 'result'
// (analyzing is now handled inside UploadScene3D)
export default function App() {
  const [stage, setStage] = useState("disclaimer");
  const [file, setFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  function handleAcceptDisclaimer() {
    setStage("upload");
  }

  function handleUpload(uploadedFile) {
    setFile(uploadedFile);
    setStage("analyzing");
  }

  function handleAnalysisComplete(result) {
    setAnalysisResult(result);
    setStage("result");
  }

  function handleReset() {
    setFile(null);
    setAnalysisResult(null);
    setStage("upload");
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#000",
      }}
    >
      {stage === "disclaimer" && (
        <DisclaimerModal onAccept={() => setStage("upload")} />
      )}
      {stage === "upload" && (
        <UploadScene3D
          onAnalysisComplete={(uploadedFile) => {
            setFile(uploadedFile);
            setStage("result");
          }}
        />
      )}
      {stage === "result" && (
        <ResultPage
          file={file}
          onReset={() => {
            setFile(null);
            setStage("upload");
          }}
        />
      )}
    </div>
  );
}

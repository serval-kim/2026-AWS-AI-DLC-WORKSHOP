import { useState } from "react";
import DisclaimerModal from "./components/DisclaimerModal";
import UploadScene3D from "./components/upload/UploadScene3D";
import AnalyzingPage from "./components/AnalyzingPage";
import ResultPage from "./components/ResultPage";

// Stages: 'disclaimer' → 'upload' (3D scene) → 'analyzing' (backend) → 'result'
export default function App() {
  const [stage, setStage] = useState("disclaimer");
  const [file, setFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

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
            setStage("analyzing");
          }}
        />
      )}
      {stage === "analyzing" && (
        <AnalyzingPage
          file={file}
          onComplete={(result) => {
            setAnalysisResult(result);
            setStage("result");
          }}
        />
      )}
      {stage === "result" && (
        <ResultPage
          file={file}
          analysisResult={analysisResult}
          onReset={() => {
            setFile(null);
            setAnalysisResult(null);
            setStage("upload");
          }}
        />
      )}
    </div>
  );
}

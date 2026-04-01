import { useState } from "react";
import { runDbt } from "../hooks/useApi";

export default function DbtPanel() {
  const [running, setRunning] = useState(false);
  const [lastOutput, setLastOutput] = useState("");
  const [select, setSelect] = useState("");

  const handleRun = async (command) => {
    setRunning(true);
    setLastOutput("");
    try {
      const r = await runDbt(command, select);
      setLastOutput(`dbt ${command} disparado. ${r.message || ""}`);
    } catch (e) {
      setLastOutput(`Erro: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="lh-dbt-controls">
        <input
          value={select}
          onChange={(e) => setSelect(e.target.value)}
          placeholder="--select (opcional, ex: staging, +marts)"
          className="lh-input lh-input-mono"
        />

        {["run", "build", "test"].map((cmd) => (
          <button
            key={cmd}
            onClick={() => handleRun(cmd)}
            disabled={running}
            className={cmd === "run" ? "lh-button-primary" : "lh-button-secondary"}
            style={{ opacity: running ? 0.6 : 1 }}
          >
            dbt {cmd}
          </button>
        ))}
      </div>

      {lastOutput && <div className="lh-code-block lh-output-block">{lastOutput}</div>}
    </div>
  );
}

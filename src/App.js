import './App.css';
import FaceTracker from './components/Face';
import Settings from './components/Settings';
import MathProblem from './components/MathProblem';

function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");

  if (mode === "study") return <FaceTracker/>;
  else if (mode === "math") return <MathProblem/>;
  else return <Settings/>
}

export default App;

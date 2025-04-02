import { useState } from "react";
import GardenSceneIntro from "../../components/scenes/garden/intro";
import GardenSceneInteractive from "../../components/scenes/garden/interactive";

export default function GardenView() {
  const [scene, setScene] = useState<"intro" | "interactive">("intro");

  const handleIntroComplete = () => {
    setScene("interactive");
  };

  return (
    <>
      {scene === "intro" && <GardenSceneIntro onComplete={handleIntroComplete} />}
      {scene === "interactive" && <GardenSceneInteractive />}
    </>
  );
}
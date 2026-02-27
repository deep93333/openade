import { useEffect, useState } from "react";
import type { AgentSkillItem } from "@agentide/shared";
import { getElectronAPI } from "@/lib/electron";

export function useAgentSkills(): AgentSkillItem[] {
  const [skills, setSkills] = useState<AgentSkillItem[]>([]);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.skills) {
      setSkills([]);
      return;
    }
    let cancelled = false;
    api.skills.list().then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setSkills(res.data);
      else setSkills([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return skills;
}

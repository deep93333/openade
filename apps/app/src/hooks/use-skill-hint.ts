import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useAgentSkills } from "./use-agent-skills";

export function useSkillHint() {
  const agentSkills = useAgentSkills();

  const extractMentionedSkillNames = useCallback(
    (editor: Editor | null): string[] => {
      if (!editor) return [];
      const json = editor.getJSON();
      if (!json) return [];
      const skillMap = new Map(agentSkills.map((s) => [s.id, s.name]));
      const names: string[] = [];
      const walk = (node: Record<string, unknown>) => {
        if (node.type === "mention") {
          const id = (node.attrs as Record<string, string> | undefined)?.id;
          if (id && skillMap.has(id)) names.push(skillMap.get(id)!);
        }
        if (Array.isArray(node.content)) {
          for (const child of node.content) walk(child as Record<string, unknown>);
        }
      };
      walk(json as Record<string, unknown>);
      return [...new Set(names)];
    },
    [agentSkills]
  );

  const withSkillHint = useCallback(
    (text: string, skills: string[]): string => {
      if (skills.length === 0) return text;
      const hint = skills.length === 1
        ? `Use the "${skills[0]}" skill.`
        : `Use these skills: ${skills.map((n) => `"${n}"`).join(", ")}.`;
      return `${hint}\n\n${text}`;
    },
    []
  );

  const augmentWithSkillHint = useCallback(
    (editor: Editor | null, text: string): string => {
      const skillNames = extractMentionedSkillNames(editor);
      return withSkillHint(text, skillNames);
    },
    [extractMentionedSkillNames, withSkillHint]
  );

  return {
    extractMentionedSkillNames,
    withSkillHint,
    augmentWithSkillHint,
  };
}

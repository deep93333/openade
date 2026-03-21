import { getElectronAPI } from "@/lib/electron";
import { useUIStore } from "@/store/ui";
import {
  Badge,
  BookIcon,
  CardTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  SearchIcon,
} from "@agentide/ui";
import React, { useState, useEffect } from "react";

type AgentSkillItem = { id: string; name: string; description: string };

export function AgentSkills() {
  const [skills, setSkills] = useState<AgentSkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [detailSkill, setDetailSkill] = useState<AgentSkillItem | null>(null);
  const setSkillsCount = useUIStore((s) => s.setSkillsCount);

  useEffect(() => {
    const api = getElectronAPI()?.skills;
    if (!api) {
      setLoading(false);
      setSkills([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .list()
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (res.success && res.data) setSkills(res.data);
        else setError(res.error ?? "Failed to load skills");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : "Failed to load skills");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSkills = skills.filter(
    (skill) =>
      skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    setSkillsCount(filteredSkills.length);
  }, [filteredSkills.length, setSkillsCount]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-4 flex flex-col gap-2">
        <p className="text-sm text-muted-foreground mb-3">
          Skills available in .cursor/skills and .claude/skills
        </p>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading && <p className="text-sm text-muted-foreground">Loading skills...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && filteredSkills.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No skills found. Add SKILL.md in ~/.cursor/skills or ~/.claude/skills.
          </p>
        )}
        {!loading && !error && filteredSkills.length > 0 && (
          <div className="flex flex-col gap-2">
            {filteredSkills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} onSelect={() => setDetailSkill(skill)} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!detailSkill} onOpenChange={(open) => !open && setDetailSkill(null)}>
        <DialogContent className="max-w-md">
          {detailSkill && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 pr-8">
                  <BookIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <DialogTitle>{detailSkill.name}</DialogTitle>
                </div>
              </DialogHeader>
              <DialogBody>
                <DialogDescription className="text-left whitespace-pre-wrap">
                  {detailSkill.description}
                </DialogDescription>
                <Badge variant="outline" size="sm" className="mt-2">
                  {detailSkill.id}
                </Badge>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SkillRowProps = {
  skill: AgentSkillItem;
  onSelect: () => void;
};

function SkillRow({ skill, onSelect }: SkillRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className="flex items-center gap-2 p-2 hover:bg-foreground/5 rounded-md cursor-pointer"
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
    >
      <BookIcon className="h-5 w-5 text-muted-foreground shrink-0" />
      <CardTitle className="text-base font-medium truncate min-w-0 flex-1">{skill.name}</CardTitle>
    </div>
  );
}

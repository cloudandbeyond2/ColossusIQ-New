"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";
import { LessonProgress, StudentCourseDetail, StudentCourseSummary, type CourseUnit, type Lesson } from "@/lib/api/learning-schemas";
import { TemplateSkeleton } from "@/components/modules/shared";
import { LoadError } from "@/components/ui/load-error";
import { Fi } from "@/components/ui/icon";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Progress, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { GradeScale, QuizPlayer } from "./my-quizzes";
import { LessonContent } from "@/components/learning/lesson-content";

const COURSE_ID = /^LC-[A-F0-9]{8}$/;
const LESSON_ID = /^L\d{1,3}$/;

const STEPS = [
  { icon: "book-open-cover", title: "Read the lessons", body: "Published by your department, unit by unit." },
  { icon: "check-circle", title: "Complete each lesson", body: "Mark it complete to unlock the next one." },
  { icon: "clipboard-list-check", title: "Final assessment", body: "30 questions from what you read." },
  { icon: "diploma", title: "Get your certificate", body: "Graded by your marks, verifiable online." },
];

export function CoursesModule() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const course = params.get("course");
  const lesson = params.get("lesson");
  const go = (q: string) => router.push(`${pathname}${q}`, { scroll: true });

  if (course && COURSE_ID.test(course)) {
    return <CourseReader id={course} lessonId={lesson && LESSON_ID.test(lesson) ? lesson : null} final={params.get("view") === "final"} go={go} />;
  }
  return <CourseList go={go} />;
}

/* ─────────────────────────────── course list ─────────────────────────────── */
function CourseList({ go }: { go: (q: string) => void }) {
  const list = useQuery({ queryKey: ["my-courses"], queryFn: () => apiFetch("/api/v1/learning-courses", z.array(StudentCourseSummary)) });
  const [dept, setDept] = useState("All");
  if (list.isError) return <LoadError error={list.error} onRetry={() => void list.refetch()} />;
  if (list.isLoading || !list.data) return <TemplateSkeleton />;
  const depts = [...new Set(list.data.map((c) => c.department))].sort();
  const shown = list.data.filter((c) => dept === "All" || c.department === dept);

  return (
    <div className="space-y-6">
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Fi name={s.icon} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">
                {i + 1}. {s.title}
              </span>
              <span className="text-xs text-ink-3">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>

      {depts.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by department">
          {["All", ...depts].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDept(d)}
              aria-pressed={dept === d}
              className={cn("rounded-full border px-3 py-1.5 text-sm", dept === d ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:border-brand/40")}
            >
              {d}
            </button>
          ))}
        </div>
      ) : null}

      {!shown.length ? (
        <EmptyState title="No courses published yet" body="Your department faculty and HOD publish courses here. Check back soon." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => {
            const pct = c.lessons ? Math.round((c.completedLessons / c.lessons) * 100) : 0;
            const passed = Boolean(c.final.certificateId);
            const action = passed ? "Review course" : c.final.unlocked ? "Take final assessment" : c.completedLessons ? "Continue" : "Start course";
            return (
              <Card key={c.id} className="card-hover flex flex-col overflow-hidden">
                <div className="bg-brand-gradient px-5 py-4 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="gold">{c.department}</Badge>
                    <span className="font-sans tabular-nums text-xs text-white/80">{c.code}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold leading-snug">{c.title}</h3>
                  <p className="text-xs text-white/80">
                    {c.faculty} · Term {c.semester} · {c.credits} credits
                  </p>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="line-clamp-2 text-sm text-ink-2">{c.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
                    <span className="inline-flex items-center gap-1">
                      <Fi name="layers" /> {c.units} chapters
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Fi name="book-open-cover" /> {c.lessons} lessons
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Fi name="clock" /> ~{Math.round(c.minutes / 60)} h
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-3">
                        {c.completedLessons} of {c.lessons} lessons
                      </span>
                      <span className="font-medium text-ink">{pct}%</span>
                    </div>
                    <Progress value={pct} tone={pct === 100 ? "teal" : "brand"} className="mt-1" label={`${c.title} progress`} />
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs">
                    {passed ? (
                      <span className="inline-flex items-center gap-1.5 text-teal">
                        <Fi name="diploma" /> Certificate earned · best {c.final.bestPercentage}%
                      </span>
                    ) : c.final.unlocked ? (
                      <span className="inline-flex items-center gap-1.5 text-brand">
                        <Fi name="unlock" /> Final assessment unlocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-ink-3">
                        <Fi name="lock" /> Final assessment unlocks after all lessons
                      </span>
                    )}
                  </p>
                  <div className="mt-auto pt-4">
                    <Button className="w-full" variant={c.final.unlocked && !passed ? "gold" : "primary"} onClick={() => go(`?course=${c.id}${c.final.unlocked && !passed ? "&view=final" : ""}`)}>
                      {action} <Fi name="arrow-right" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── reader ─────────────────────────────── */
function CourseReader({ id, lessonId, final, go }: { id: string; lessonId: string | null; final: boolean; go: (q: string) => void }) {
  const qc = useQueryClient();
  const course = useQuery({ queryKey: ["my-course", id], queryFn: () => apiFetch(`/api/v1/learning-courses/${id}`, StudentCourseDetail) });
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const order = useMemo(() => (course.data ? course.data.units.flatMap((u, ui) => u.lessons.map((l) => ({ ...l, unit: u.title, unitIndex: ui }))) : []), [course.data]);
  const done = useMemo(() => new Set(course.data?.completed ?? []), [course.data]);

  const complete = useMutation({
    mutationFn: (lid: string) => apiFetch(`/api/v1/learning-courses/${id}/lessons/${lid}/complete`, LessonProgress, { method: "POST" }),
    onSuccess: async (_r, lid) => {
      await qc.invalidateQueries({ queryKey: ["my-course", id] });
      qc.invalidateQueries({ queryKey: ["my-courses"] });
      const idx = order.findIndex((l) => l.id === lid);
      const next = order[idx + 1];
      go(next ? `?course=${id}&lesson=${next.id}` : `?course=${id}&view=final`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save your progress."),
  });

  if (course.isLoading) return <TemplateSkeleton />;
  if (!course.data) return <EmptyState title="Course not available" body={course.error instanceof ApiError ? course.error.message : undefined} action={<Button onClick={() => go("")}>All courses</Button>} />;
  const c = course.data;

  const unlockedIndex = order.findIndex((l) => !done.has(l.id)); // first unfinished lesson; -1 = all done
  const isUnlocked = (i: number) => unlockedIndex === -1 || i <= unlockedIndex;
  const requested = lessonId ? order.findIndex((l) => l.id === lessonId) : -1;
  const currentIndex = requested >= 0 && isUnlocked(requested) ? requested : unlockedIndex === -1 ? 0 : unlockedIndex;
  const showFinal = final || (!lessonId && unlockedIndex === -1 && !c.final.certificateId && c.final.attempts === 0);
  const pct = order.length ? Math.round((done.size / order.length) * 100) : 0;

  // The test takes the full width; the lesson list returns when the student exits or finishes.
  if (showFinal && playing && c.final.unlocked) return <QuizPlayer id={c.final.quizId} onExit={() => setPlaying(false)} backLabel="Back to course" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => go("")} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-brand">
          <Fi name="arrow-left" /> All courses
        </button>
        <p className="text-sm text-ink-3">
          <span className="font-sans tabular-nums">{c.code}</span> · {c.department} · {c.faculty}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Lesson list */}
        <Card className="h-fit lg:sticky lg:top-20">
          <div className="border-b border-line p-5">
            <h2 className="font-semibold leading-snug text-ink">{c.title}</h2>
            <div className="mt-3 flex justify-between text-xs text-ink-3">
              <span>
                {done.size} of {order.length} lessons
              </span>
              <span className="font-medium text-ink">{pct}%</span>
            </div>
            <Progress value={pct} tone={pct === 100 ? "teal" : "brand"} className="mt-1" label="Course progress" />
          </div>
          <nav aria-label="Lessons" className="max-h-[60vh] overflow-y-auto p-3">
            {c.units.map((u, ui) => (
              <div key={`${u.title}-${ui}`} className="mb-3">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  {chapterLabel(ui, c.units.length)} · {u.title}
                </p>
                <ul>
                  {u.lessons.map((l) => {
                    const i = order.findIndex((o) => o.id === l.id);
                    const locked = !isUnlocked(i);
                    const active = !showFinal && i === currentIndex;
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => go(`?course=${c.id}&lesson=${l.id}`)}
                          aria-current={active ? "step" : undefined}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm",
                            active ? "bg-brand-soft font-medium text-brand" : locked ? "cursor-not-allowed text-ink-3/70" : "text-ink-2 hover:bg-surface-2",
                          )}
                        >
                          <Fi name={done.has(l.id) ? "check-circle" : locked ? "lock" : "circle"} className={cn("mt-0.5 shrink-0", done.has(l.id) && "text-teal")} />
                          <span className="min-w-0 flex-1">{shortTitle(l.title, u.title)}</span>
                          <span className="shrink-0 text-[11px] text-ink-3">{l.minutes}m</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <button
              type="button"
              disabled={!c.final.unlocked}
              onClick={() => go(`?course=${c.id}&view=final`)}
              aria-current={showFinal ? "step" : undefined}
              className={cn(
                "mt-1 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium",
                showFinal ? "border-gold bg-gold-soft text-ink" : c.final.unlocked ? "border-gold/50 text-ink hover:bg-gold-soft" : "cursor-not-allowed border-dashed border-line text-ink-3",
              )}
            >
              <Fi name={c.final.certificateId ? "diploma" : c.final.unlocked ? "clipboard-list-check" : "lock"} className="text-gold" />
              <span className="flex-1">Final assessment · {c.final.questions} questions</span>
            </button>
          </nav>
        </Card>

        {/* Content */}
        <div className="min-w-0">
          {error ? (
            <p role="alert" className="mb-4 rounded-xl border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
              {error}
            </p>
          ) : null}
          {showFinal ? (
            <FinalAssessment course={c} remaining={order.length - done.size} onStart={() => setPlaying(true)} onBack={() => go(`?course=${c.id}&lesson=${order[order.length - 1]?.id ?? "L1"}`)} />
          ) : order[currentIndex] ? (
            <LessonView
              lesson={order[currentIndex]}
              unit={order[currentIndex].unit}
              units={c.units}
              chapterIndex={order[currentIndex].unitIndex}
              index={currentIndex}
              total={order.length}
              completed={done.has(order[currentIndex].id)}
              busy={complete.isPending}
              onPrev={currentIndex > 0 ? () => go(`?course=${c.id}&lesson=${order[currentIndex - 1]!.id}`) : undefined}
              onNext={() => {
                setError(null);
                const cur = order[currentIndex]!;
                if (!done.has(cur.id)) complete.mutate(cur.id);
                else {
                  const next = order[currentIndex + 1];
                  go(next ? `?course=${c.id}&lesson=${next.id}` : `?course=${c.id}&view=final`);
                }
              }}
            />
          ) : (
            <EmptyState title="This course has no lessons yet" />
          )}
        </div>
      </div>
    </div>
  );
}

/** "Chapter 3", with the orientation and revision chapters named instead of numbered. */
function chapterLabel(index: number, count: number): string {
  return index === 0 ? "Start here" : index === count - 1 ? "Revision" : `Chapter ${index}`;
}

/** Inside a chapter, "Normalization — key concepts" reads better as just "Key concepts". */
function shortTitle(title: string, chapter: string): string {
  const prefix = `${chapter} — `;
  if (!title.startsWith(prefix)) return title;
  const rest = title.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function LessonView({
  lesson,
  unit,
  units,
  chapterIndex,
  index,
  total,
  completed,
  busy,
  onPrev,
  onNext,
}: {
  lesson: Lesson;
  unit: string;
  units: CourseUnit[];
  chapterIndex: number;
  index: number;
  total: number;
  completed: boolean;
  busy: boolean;
  onPrev?: () => void;
  onNext: () => void;
}) {
  const last = index === total - 1;
  return (
    <Card>
      <div className="border-b border-line px-6 py-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
          {unit} · Lesson {index + 1} of {total} · ~{lesson.minutes} min
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">{lesson.title}</h2>
        {completed ? (
          <Badge tone="teal" className="mt-2">
            <Fi name="check" /> Completed
          </Badge>
        ) : null}
      </div>
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        <LessonContent lesson={lesson} units={units} chapterIndex={chapterIndex} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-surface-2/60 px-6 py-4 sm:px-8">
        <Button variant="secondary" onClick={onPrev} disabled={!onPrev}>
          <Fi name="arrow-left" /> Previous
        </Button>
        <Button variant={last && !completed ? "gold" : "primary"} onClick={onNext} disabled={busy}>
          {busy ? <Spinner /> : null}
          {completed ? (last ? "Go to final assessment" : "Next lesson") : last ? "Complete & go to final assessment" : "Mark complete & next"} <Fi name="arrow-right" />
        </Button>
      </div>
    </Card>
  );
}

function FinalAssessment({ course, remaining, onStart, onBack }: { course: StudentCourseDetail; remaining: number; onStart: () => void; onBack: () => void }) {
  const f = course.final;

  if (!f.unlocked) {
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl text-ink-3">
          <Fi name="lock" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-ink">Final assessment locked</h2>
        <p className="mt-1 text-sm text-ink-2">
          Complete the remaining {remaining} lesson{remaining === 1 ? "" : "s"} to unlock the {f.questions}-question final assessment.
        </p>
        <Button className="mt-5" onClick={onBack}>
          Continue reading
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_300px]">
      <Card>
        <div className="bg-brand-gradient rounded-t-2xl px-6 py-6 text-white">
          <p className="text-xs uppercase tracking-widest text-white/70">Final assessment</p>
          <h2 className="mt-1 text-2xl font-semibold">{course.title}</h2>
          <p className="mt-1 text-sm text-white/85">Questions come from the lessons you have just read.</p>
        </div>
        <CardBody className="space-y-5 pt-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Questions", value: f.questions },
              { label: "Time", value: `${f.durationMin} min` },
              { label: "Pass mark", value: `${f.passMark}%` },
              { label: "Attempts left", value: f.attemptsLeft },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-surface-2 p-3 text-center">
                <p className="text-xl font-semibold text-ink">{s.value}</p>
                <p className="text-xs text-ink-3">{s.label}</p>
              </div>
            ))}
          </div>
          {f.certificateId ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teal/30 bg-teal-soft p-4 text-sm">
              <Fi name="diploma" className="text-2xl text-teal" />
              <span className="flex-1 text-ink">
                You passed with <b>{f.bestPercentage}%</b>. Your certificate is ready.
              </span>
              <Link href={`/verify/${f.certificateId}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                View certificate
              </Link>
            </div>
          ) : f.bestPercentage !== null ? (
            <p className="rounded-xl bg-amber-soft p-4 text-sm text-ink-2">
              Best so far: <b>{f.bestPercentage}%</b> (pass mark {f.passMark}%). Revise the lessons and try again.
            </p>
          ) : null}
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>The timer starts when you begin and the test submits automatically when time runs out.</li>
            <li>Your answers are marked on the server; you see every correct answer and explanation afterwards.</li>
            <li>Pass to receive a certificate graded by your marks. Your best attempt counts.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            {f.attemptsLeft > 0 ? (
              <Button variant="gold" size="lg" onClick={onStart}>
                <Fi name="play" /> {f.attempts ? "Retake final assessment" : "Start final assessment"}
              </Button>
            ) : (
              <Badge tone="neutral">No attempts left</Badge>
            )}
            <Button variant="secondary" size="lg" onClick={onBack}>
              Review lessons
            </Button>
          </div>
        </CardBody>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
        <GradeScale />
        <Card>
          <CardHeader title="Course outcomes" />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {course.outcomes.map((o) => (
                <li key={o.code} className="text-ink-2">
                  <b className="text-brand">{o.code}</b> {o.text}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

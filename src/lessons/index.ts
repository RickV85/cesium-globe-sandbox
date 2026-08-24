import { cameraLesson } from "./01-camera";
import { entitiesLesson } from "./02-entities";
import { terrainLesson } from "./03-terrain";
import { imageryLesson } from "./04-imagery";
import { pickingLesson } from "./05-picking";
import { timeLesson } from "./06-time";
import { noaaLesson } from "./07-noaa";
import type { Lesson } from "./types";

export const LESSONS: Lesson[] = [
  cameraLesson,
  entitiesLesson,
  terrainLesson,
  imageryLesson,
  pickingLesson,
  timeLesson,
  noaaLesson,
];

export type { Lesson, LessonContext } from "./types";

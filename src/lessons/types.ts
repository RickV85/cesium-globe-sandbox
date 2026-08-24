import * as Cesium from "cesium";

export type LessonContext = {
  viewer: Cesium.Viewer;
  /** Prints a line into the panel's output area. */
  log: (message: string) => void;
};

export type Lesson = {
  id: string;
  title: string;
  /** One or two sentences shown above the code snippet. */
  summary: string;
  /** The essential Cesium calls, shown in the panel so you can read along. */
  snippet: string;
  run: (ctx: LessonContext) => void | Promise<void>;
  /** Tear down anything run() attached that removeAll() will not catch. */
  cleanup?: (ctx: LessonContext) => void;
};

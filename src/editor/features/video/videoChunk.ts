"use client";

/*
  Чанк видео (ADR-0058, п. 11.1): узел, вид узла с плеером и поле ссылки.
  Описания Инструментов `youtube` и `twitch` (`videoTools.ts`) держат только
  загрузчик этого файла, а его самого в «старт» не берут: страница без видео не
  платит за плеер.
*/
export { createVideoNode } from "./video.js";
export { VideoForm } from "./VideoForm.js";

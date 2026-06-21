"use client";

import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { useGSAP } from "@gsap/react";

/**
 * Central GSAP setup. Plugins must be registered once at the module level
 * (never inside a component body) so they survive Fast Refresh and the
 * client/server boundary. Import `gsap`, `Draggable`, and `useGSAP` from here
 * rather than from the raw packages so registration always runs first.
 */
gsap.registerPlugin(Draggable, useGSAP);

export { gsap, Draggable, useGSAP };

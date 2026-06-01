import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import logsRouter from "./logs";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(logsRouter);
router.use(statsRouter);

export default router;

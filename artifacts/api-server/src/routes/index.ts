import { Router, type IRouter } from "express";
import healthRouter from "./health";
import swapsRouter from "./swaps";
import adminRouter from "./admin";
import odosRouter from "./odos";

const router: IRouter = Router();

router.use(healthRouter);
router.use(swapsRouter);
router.use("/admin", adminRouter);
router.use(odosRouter);

export default router;

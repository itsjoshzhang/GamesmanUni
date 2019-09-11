import * as style from "@/datas/styles/SLight";
import { IVisualizer } from "@/interfaces/IVisualizer";
import { CGame } from "@/classes/CGame";
import { CHistory } from "./CHistory";
import { CRound } from "./CRound";

export class CVisualizer implements IVisualizer {
  private history: CHistory;
  private maximumRemoteness: number;
  private currentRoundNumber: number;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  font: any;
  mainColor: any;
  winColor: any;
  drawColor: any;
  tieColor: any;
  loseColor: any;

  turnName0: string;
  turnName1: string;

  xLabel: string;
  yLeftLabel: string;
  yRightLabel: string;

  padding: number;

  turnNameHeight: number;
  xCoordinateHeight: number;
  xLabelHeight: number;
  rowHeight: number;

  private rowCount: number;
  private gridHeight: number;
  private canvasHeight: number;

  yCoordinateWidth: number;
  yLabelWidth: number;
  columnWidth: number;

  private columnCount: number;
  private gridWidth: number;
  private canvasWidth: number;

  private gridTop: number;
  private gridBottom: number;
  private gridLeft: number;
  private gridMiddleX: number;
  private gridRight: number;

  pointRadius: number;
  linkWidth: number;
  xBarWidth: number;
  xIntervalBarWidth: number;
  xInterval: number;

  private pointCoordinates: {
    [round: number]: { x: number | [number, number]; y: number };
  };

  constructor(game: CGame, currentRoundNumber?: number) {
    this.history = game.history;
    this.maximumRemoteness = this.history.maximumRemoteness;
    this.currentRoundNumber =
      currentRoundNumber ||
      (this.history.rounds.length != 0 && this.history.rounds.length) ||
      1;

    this.canvas = document.getElementById(
      game.visualizerSelectorId
    ) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

    this.font = style.font;
    this.mainColor = style.mainColor;
    this.winColor = style.winColor;
    this.drawColor = style.drawColor;
    this.tieColor = style.tieColor;
    this.loseColor = style.loseColor;

    this.turnName0 = game.turnNames[0];
    this.turnName1 = game.turnNames[1];

    this.xLabel = "Remoteness";
    this.yLeftLabel = "round";
    this.yRightLabel = "turn";

    this.padding = 10;
    this.turnNameHeight = 10;
    this.xCoordinateHeight = 10;
    this.xLabelHeight = 10;
    this.rowHeight = 10;

    this.rowCount = this.currentRoundNumber;
    this.gridHeight = this.rowHeight * this.rowCount;
    this.canvasHeight =
      this.turnNameHeight +
      2 * (this.padding + this.xCoordinateHeight + this.xLabelHeight) +
      this.gridHeight;

    this.yCoordinateWidth = 10;
    this.yLabelWidth = 10;
    this.columnWidth = 10;

    this.columnCount = 2 * this.maximumRemoteness + 3;
    this.gridWidth = this.columnWidth * this.columnCount;
    this.canvasWidth =
      2 * (this.padding + this.yCoordinateWidth + this.yLabelWidth) +
      this.gridWidth;

    this.gridTop =
      this.padding +
      this.turnNameHeight +
      this.xLabelHeight +
      this.xCoordinateHeight;
    this.gridBottom = this.gridTop + this.gridHeight;
    this.gridLeft = this.padding + this.yLabelWidth + this.yCoordinateWidth;
    this.gridMiddleX = this.gridLeft + this.gridWidth / 2;
    this.gridRight = this.gridLeft + this.gridWidth;

    this.pointRadius = 5;
    this.linkWidth = 1;
    this.xBarWidth = 1;
    this.xIntervalBarWidth = 2;
    this.xInterval = 5;

    this.pointCoordinates = {};
  }

  drawVisualizer() {
    this.setCanvasShape();
    this.setVisualizerFrame();
    this.setTurnNames();
    this.setXLabel();
    this.setXCoordinates();
    this.setYLabel();
    this.setYCoordinates();
    this.setGrid();
    this.getPointCoordinates();
    this.setGraph();
  }

  private setCanvasShape(): void {
    this.canvas.height = this.canvasHeight;
    this.canvas.width = this.canvasWidth;
  }

  private setVisualizerFrame(): void {
    this.ctx.strokeStyle = this.mainColor;
    this.ctx.rect(0, 0, this.canvasWidth, this.canvasHeight);
    this.ctx.stroke();
  }

  private setText(text: string, x: number, y: number, color: string): void {
    this.ctx.textBaseline = "middle";
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = color;
    this.ctx.font = this.font;
    this.ctx.fillText(text, x, y);
  }

  private setTurnNames(): void {
    this.setText(
      this.turnName0,
      this.gridMiddleX - this.gridWidth / 4,
      this.padding + this.turnNameHeight / 2,
      this.mainColor
    );
    this.setText(
      this.turnName1,
      this.gridMiddleX + this.gridWidth / 4,
      this.padding + this.turnNameHeight / 2,
      this.mainColor
    );
  }

  private remotenessToX(remoteness: number, turn: number): number {
    if (turn === 0) {
      return this.gridLeft + (remoteness + 0.5) * this.columnWidth;
    }
    return this.gridRight - (remoteness + 0.5) * this.columnWidth;
  }

  private roundToY(round: number): number {
    return this.gridTop + (round - 0.5) * this.rowHeight;
  }

  private setXLabel(): void {
    this.setText(
      this.xLabel,
      this.canvasWidth / 2,
      this.padding + this.turnNameHeight + this.xLabelHeight / 2,
      this.mainColor
    );
  }

  private setXCoordinates(): void {
    this.setText(
      "D",
      this.gridMiddleX,
      this.gridTop - this.xCoordinateHeight / 2,
      this.mainColor
    );
    this.setText(
      "D",
      this.gridMiddleX,
      this.gridBottom + this.xCoordinateHeight / 2,
      this.mainColor
    );
    for (
      let remoteness: number = 0;
      remoteness <= this.maximumRemoteness;
      remoteness += this.xInterval
    ) {
      this.setText(
        remoteness.toString(),
        this.remotenessToX(remoteness, 0),
        this.gridTop - this.xLabelHeight / 2,
        this.mainColor
      );
      this.setText(
        remoteness.toString(),
        this.remotenessToX(remoteness, 1),
        this.gridTop - this.xLabelHeight / 2,
        this.mainColor
      );
      this.setText(
        remoteness.toString(),
        this.remotenessToX(remoteness, 0),
        this.gridBottom + this.xLabelHeight / 2,
        this.mainColor
      );
      this.setText(
        remoteness.toString(),
        this.remotenessToX(remoteness, 1),
        this.gridBottom + this.xLabelHeight / 2,
        this.mainColor
      );
    }
  }

  private setYLabel(): void {
    // TBS
  }

  private setYCoordinates(): void {
    for (let round: number = 1; round <= this.currentRoundNumber; round++) {
      this.setText(
        round.toString(),
        this.gridLeft - this.yLabelWidth / 2,
        this.roundToY(round),
        this.mainColor
      );
      this.setText(
        this.history.rounds[round - 1].turnNumber.toString(),
        this.gridRight + this.yLabelWidth / 2,
        this.roundToY(round),
        this.mainColor
      );
    }
  }

  private setGrid(): void {
    this.ctx.strokeStyle = this.mainColor;
    for (
      let remoteness: number = 0;
      remoteness <= this.maximumRemoteness + 1;
      remoteness++
    ) {
      if (
        remoteness % this.xInterval === 0 ||
        remoteness === this.maximumRemoteness + 1
      ) {
        this.ctx.lineWidth = this.xIntervalBarWidth;
      } else {
        this.ctx.lineWidth = this.xBarWidth;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(this.remotenessToX(remoteness, 0), this.gridTop);
      this.ctx.lineTo(this.remotenessToX(remoteness, 0), this.gridBottom);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(this.remotenessToX(remoteness, 1), this.gridTop);
      this.ctx.lineTo(this.remotenessToX(remoteness, 1), this.gridBottom);
      this.ctx.stroke();
    }
  }

  private getPointCoordinates(): void {
    let roundData: CRound;
    let x: number | [number, number];
    let y: number;
    for (let round = 1; round <= this.currentRoundNumber; round++) {
      roundData = this.history.rounds[round - 1];
      if (roundData.positionValue === "draw") {
        x = this.gridMiddleX;
      } else if (roundData.positionValue === "tie") {
        x = [
          this.remotenessToX(roundData.remoteness, 0),
          this.remotenessToX(roundData.remoteness, 1)
        ];
      } else if (roundData.positionValue === "lose") {
        x = this.remotenessToX(
          roundData.remoteness,
          (roundData.turnNumber + 1) % 2
        );
      } else {
        x = this.remotenessToX(roundData.remoteness, roundData.turnNumber);
      }
      y = this.roundToY(round);
      this.pointCoordinates[round] = { x: x, y: y };
    }
  }

  private valueToColor(value: string): any {
    if (value === "win") {
      return this.winColor;
    } else if (value === "draw") {
      return this.drawColor;
    } else if (value === "tie") {
      return this.tieColor;
    } else {
      return this.loseColor;
    }
  }

  private setLink(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string
  ): void {
    this.ctx.lineWidth = this.linkWidth;
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  private setPoint(x: number, y: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.pointRadius, 0, 2 * Math.PI);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private setLinks(): void {
    let x1, y1, x2, y2, color;
    for (let round = 1; round < this.currentRoundNumber; round++) {
      x1 = this.pointCoordinates[round].x;
      y1 = this.pointCoordinates[round].y;
      x2 = this.pointCoordinates[round + 1].x;
      y2 = this.pointCoordinates[round + 1].y;
      color = this.valueToColor(this.history.rounds[round - 1].moveValue);
      if (typeof x1 === "number" && typeof x2 === "number") {
        this.setLink(x1, y1, x2, y2, color);
      } else if (typeof x1 === "number" && typeof x2 != "number") {
        this.setLink(x1, y1, x2[0], y2, color);
        this.setLink(x1, y1, x2[1], y2, color);
      } else if (typeof x1 != "number" && typeof x2 === "number") {
        this.setLink(x1[0], y1, x2, y2, color);
        this.setLink(x1[1], y1, x2, y2, color);
      } else if (typeof x1 != "number" && typeof x2 != "number") {
        this.setLink(x1[0], y1, x2[0], y2, color);
        this.setLink(x1[0], y1, x2[1], y2, color);
      }
    }
  }

  private setPoints(): void {
    let x, y, color;
    for (let round = 1; round <= this.currentRoundNumber; round++) {
      x = this.pointCoordinates[round].x;
      y = this.pointCoordinates[round].y;
      color = this.valueToColor(this.history.rounds[round - 1].positionValue);
      if (typeof x === "number") {
        this.setPoint(x, y, color);
      } else {
        this.setLink(x[0], y, x[1], y, color);
        this.setPoint(x[0], y, color);
        this.setPoint(x[1], y, color);
      }
    }
  }

  private setGraph(): void {
    this.setLinks();
    this.setPoints();
  }
}

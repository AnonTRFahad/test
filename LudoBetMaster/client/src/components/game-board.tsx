import { GameState } from "@shared/schema";
import { cn } from "@/lib/utils";

interface GameBoardProps {
  gameState: GameState;
  onPieceClick: (pieceIndex: number) => void;
}

const BOARD_SIZE = 600;
const CELL_SIZE = BOARD_SIZE / 15;
const PIECE_SIZE = CELL_SIZE * 0.8;

const PLAYER_COLORS = {
  0: "bg-red-500",
  1: "bg-blue-500",
  2: "bg-green-500",
  3: "bg-yellow-500",
};

const HOME_POSITIONS = {
  0: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  1: [
    [1, 11],
    [1, 13],
    [3, 11],
    [3, 13],
  ],
  2: [
    [11, 1],
    [11, 3],
    [13, 1],
    [13, 3],
  ],
  3: [
    [11, 11],
    [11, 13],
    [13, 11],
    [13, 13],
  ],
};

const PATH_COORDINATES = {
  0: [
    [6, 1],
    [6, 2],
    [6, 3],
    [6, 4],
    [6, 5],
    [5, 6],
    [4, 6],
    [3, 6],
    [2, 6],
    [1, 6],
    [0, 6],
    [0, 7],
    [0, 8],
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
    [5, 8],
    [6, 9],
    [6, 10],
    [6, 11],
    [6, 12],
    [6, 13],
    [6, 14],
    [7, 14],
    [8, 14],
    [8, 13],
    [8, 12],
    [8, 11],
    [8, 10],
    [8, 9],
    [9, 8],
    [10, 8],
    [11, 8],
    [12, 8],
    [13, 8],
    [14, 8],
    [14, 7],
    [14, 6],
    [13, 6],
    [12, 6],
    [11, 6],
    [10, 6],
    [9, 6],
    [8, 5],
    [8, 4],
    [8, 3],
    [8, 2],
    [8, 1],
    [8, 0],
    [7, 0],
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
};

// Generate paths for other players by rotating the first player's path
const generateAllPaths = () => {
  const paths: Record<number, number[][]> = { 0: PATH_COORDINATES[0] };
  
  for (let player = 1; player < 4; player++) {
    paths[player] = PATH_COORDINATES[0].map(([x, y]) => {
      for (let i = 0; i < player; i++) {
        [x, y] = [y, 14 - x]; // Rotate 90 degrees clockwise
      }
      return [x, y];
    });
  }
  
  return paths;
};

const PATHS = generateAllPaths();

export default function GameBoard({ gameState, onPieceClick }: GameBoardProps) {
  const getCoordinates = (player: number, position: number) => {
    if (position === 0) {
      // Piece is in home
      return HOME_POSITIONS[player][0];
    } else if (position >= 56) {
      // Piece has finished
      return HOME_POSITIONS[player][3];
    }
    return PATHS[player][position - 1];
  };

  return (
    <div className="relative aspect-square w-full max-w-[600px] mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      <svg
        viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
        className="w-full h-full"
      >
        {/* Board grid */}
        <defs>
          <pattern
            id="grid"
            width={CELL_SIZE}
            height={CELL_SIZE}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`}
              fill="none"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Home areas */}
        <rect x="0" y="0" width={CELL_SIZE * 6} height={CELL_SIZE * 6} fill="#ffcdd2" />
        <rect x={CELL_SIZE * 9} y="0" width={CELL_SIZE * 6} height={CELL_SIZE * 6} fill="#bbdefb" />
        <rect x="0" y={CELL_SIZE * 9} width={CELL_SIZE * 6} height={CELL_SIZE * 6} fill="#c8e6c9" />
        <rect x={CELL_SIZE * 9} y={CELL_SIZE * 9} width={CELL_SIZE * 6} height={CELL_SIZE * 6} fill="#fff9c4" />

        {/* Center square */}
        <rect
          x={CELL_SIZE * 6}
          y={CELL_SIZE * 6}
          width={CELL_SIZE * 3}
          height={CELL_SIZE * 3}
          fill="#f5f5f5"
          stroke="rgba(0,0,0,0.1)"
        />
      </svg>

      {/* Game pieces */}
      {gameState.players.map((player, playerIndex) => (
        player.pieces.map((position, pieceIndex) => {
          const [x, y] = getCoordinates(playerIndex, position);
          return (
            <div
              key={`${playerIndex}-${pieceIndex}`}
              className={cn(
                "absolute rounded-full border-2 border-white shadow-md transition-all duration-300 cursor-pointer transform hover:scale-110",
                PLAYER_COLORS[playerIndex as keyof typeof PLAYER_COLORS],
                gameState.currentTurn === player.id && position < 56 && "animate-pulse"
              )}
              style={{
                width: PIECE_SIZE,
                height: PIECE_SIZE,
                left: `${(x * CELL_SIZE + (CELL_SIZE - PIECE_SIZE) / 2) / BOARD_SIZE * 100}%`,
                top: `${(y * CELL_SIZE + (CELL_SIZE - PIECE_SIZE) / 2) / BOARD_SIZE * 100}%`,
              }}
              onClick={() => onPieceClick(pieceIndex)}
            />
          );
        })
      ))}
    </div>
  );
}

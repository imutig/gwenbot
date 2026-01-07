/**
 * Sudoku Engine - Generate and validate puzzles
 * Server-side module for GwenBot
 */

class SudokuEngine {
    /**
     * Generate a complete valid Sudoku grid
     * @returns {string} 81-character string representing the solution
     */
    static generateSolution() {
        const grid = Array(81).fill(0);
        this.solve(grid);
        return grid.join('');
    }

    /**
     * Solve a Sudoku grid using backtracking
     * @param {number[]} grid - 81-element array
     * @returns {boolean} true if solved
     */
    static solve(grid) {
        const empty = grid.indexOf(0);
        if (empty === -1) return true;

        const row = Math.floor(empty / 9);
        const col = empty % 9;
        const nums = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

        for (const num of nums) {
            if (this.isValid(grid, row, col, num)) {
                grid[empty] = num;
                if (this.solve(grid)) return true;
                grid[empty] = 0;
            }
        }
        return false;
    }

    /**
     * Check if a number can be placed at position
     */
    static isValid(grid, row, col, num) {
        // Check row
        for (let c = 0; c < 9; c++) {
            if (grid[row * 9 + c] === num) return false;
        }

        // Check column
        for (let r = 0; r < 9; r++) {
            if (grid[r * 9 + col] === num) return false;
        }

        // Check 3x3 box
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (grid[(boxRow + r) * 9 + (boxCol + c)] === num) return false;
            }
        }

        return true;
    }

    /**
     * Generate a puzzle by removing cells from solution
     * @param {string} difficulty - 'easy', 'medium', 'hard'
     * @returns {{puzzle: string, solution: string}}
     */
    static generatePuzzle(difficulty = 'medium') {
        const solution = this.generateSolution();
        const puzzle = solution.split('').map(n => parseInt(n));

        // Number of cells to remove based on difficulty
        const cellsToRemove = {
            easy: 35,
            medium: 45,
            hard: 55
        }[difficulty] || 45;

        // Remove cells randomly
        const positions = this.shuffle([...Array(81).keys()]);
        let removed = 0;

        for (const pos of positions) {
            if (removed >= cellsToRemove) break;
            puzzle[pos] = 0;
            removed++;
        }

        return {
            puzzle: puzzle.join(''),
            solution
        };
    }

    /**
     * Validate if a grid is correctly solved
     * @param {string} grid - 81-character string
     * @param {string} solution - 81-character solution
     * @returns {boolean}
     */
    static validateSolution(grid, solution) {
        return grid === solution;
    }

    /**
     * Count filled cells in a grid
     * @param {string} grid - 81-character string
     * @returns {number}
     */
    static countFilled(grid) {
        return grid.split('').filter(c => c !== '0').length;
    }

    /**
     * Check if a specific cell entry is correct
     * @param {number} index - Cell index (0-80)
     * @param {number} value - Entered value
     * @param {string} solution - Solution string
     * @returns {boolean}
     */
    static checkCell(index, value, solution) {
        return parseInt(solution[index]) === value;
    }

    /**
     * Fisher-Yates shuffle
     */
    static shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

module.exports = SudokuEngine;

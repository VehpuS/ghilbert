﻿GH.ProofGenerator.evaluatorLessThan = function(prover) {
  this.prover = prover;
  this.operators = ['<'];
};

GH.ProofGenerator.evaluatorLessThan.prototype.variableAction = function(sexp) {
	return null;
};

GH.ProofGenerator.evaluatorLessThan.prototype.action = function(sexp) {
	var leftNum  = this.prover.calculate(sexp.left());
	var rightNum = this.prover.calculate(sexp.right());
	if (leftNum < rightNum) {
		operatorName = 'less';
	} else {
		operatorName = 'greaterEq';
	}
	return new GH.action(leftNum + operatorName + rightNum, []);
};

GH.ProofGenerator.evaluatorLessThan.prototype.isApplicable = function(sexp) {
	return true;
};

GH.ProofGenerator.evaluatorLessThan.prototype.inline = function(sexp) {
	var leftNum  = this.prover.calculate(sexp.left());
	var rightNum = this.prover.calculate(sexp.right());
	if ((leftNum == 0) && (10 >= rightNum) && (rightNum > 0)) {
		return this.zeroLessThanNum(sexp, rightNum);
	} else if (leftNum < rightNum) {
		if ((leftNum <= 10) && (rightNum <= 10)) {
			return this.addToBothSides(sexp, 0, rightNum - leftNum, leftNum, 'Single-Digit Inequality');
		} else {
			return this.inequality(sexp, leftNum, rightNum);
		}
	} else if (leftNum == rightNum) {
		this.prover.evaluate(this.prover.create('=', [sexp.left(), sexp.right()]));
		var result = this.prover.getLast();
		return this.prover.operationExchange(result, '¬<');
	} else if (leftNum > rightNum) {
		this.prover.evaluate(this.prover.create('>', [sexp.left(), sexp.right()]));
		var result = this.prover.getLast();
		return this.prover.operationExchange(result, '¬<');
	} 
	return null;
};

GH.ProofGenerator.evaluatorLessThan.prototype.zeroLessThanNum = function(sexp, rightNum) {
	sexp = this.prover.openExp(sexp, 'Separate into smaller inequalities');
	var inequality1 = this.prover.create('<', [0, rightNum - 1]);
	var inequality2 = this.prover.create('<', [rightNum - 1, rightNum]);
	var result1 = this.prover.evaluate(inequality1, 'Smaller Inequality');
	var result2 = this.prover.evaluate(inequality2, 'Smaller Inequality');
	sexp = this.prover.replace(result1.right());
	sexp = this.prover.closeExp(sexp);
	return this.prover.getLast();
};

GH.ProofGenerator.evaluatorLessThan.prototype.addToBothSides = function(sexp, leftNum, rightNum, addition, name) {
	var inequality = this.prover.create('<', [leftNum, rightNum]);   // leftNum < rightNum
	name = name || 'Add To Both Sides';
	this.prover.openExp(sexp, name);
	this.prover.openExp(sexp, 'Derive Smaller Inequality');
	this.prover.evaluate(inequality);
	this.prover.closeExp(sexp);

	this.prover.openExp(sexp, 'Add To Both Sides');
	var addExp = GH.numUtil.createNum(addition);
	this.prover.print([addExp], 'ltadd2i');
	this.prover.closeExp(sexp);
	result = this.prover.getLast();
	result = this.prover.evaluate(result.left(), 'Simplify Left Side').parent;
	result = this.prover.evaluate(result.right(), 'Simplify Right Side').parent;
	return this.prover.closeExp(result);
};

GH.ProofGenerator.evaluatorLessThan.prototype.inequality = function(sexp, leftNum, rightNum) {
	var commonDigits = 0;
	var leftHighest = GH.numUtil.mostSignificantDigit(leftNum);
	var rightHighest = GH.numUtil.mostSignificantDigit(rightNum);
	while (leftHighest == rightHighest) {
		commonDigits += leftHighest;
		leftHighest = GH.numUtil.mostSignificantDigit(leftNum - commonDigits);
		rightHighest = GH.numUtil.mostSignificantDigit(rightNum - commonDigits);
	}
	// Handle case with common digits such as 123 < 127.
	if (commonDigits) {
		return this.addToBothSides(sexp, leftNum - commonDigits, rightNum - commonDigits, commonDigits, 'Compare Smaller Digits');
	}
	// Handle round numbers like 30 < 80.
	if ((leftNum - leftHighest == 0) && (rightNum - rightHighest == 0)) {
		var leftDigits  = GH.numUtil.numOfDigits(leftNum);
		var rightDigits = GH.numUtil.numOfDigits(rightNum);
		var base = Math.pow(10, GH.numUtil.numOfDigits(leftNum) - 1);
	    if ((leftDigits == rightDigits) ||
		   ((leftDigits == rightDigits - 1) && (rightNum / base == 10))) {
			return this.roundNumbers(sexp, leftNum, rightNum);
		}
	}
	return this.arbitraryNumbers(sexp, leftNum, rightNum);
};

GH.ProofGenerator.evaluatorLessThan.prototype.roundNumbers = function(sexp, leftNum, rightNum) {
	var base = Math.pow(10, GH.numUtil.numOfDigits(leftNum) - 1);
	var leftMultiplier  = leftNum  / base;
	var rightMultiplier = rightNum / base;

	var multiplierInequality = this.prover.create('<', [leftMultiplier, rightMultiplier]);
	var baseInequality = this.prover.create('<', [0, base]);
	this.prover.openExp(sexp, 'Compare First Digits');
	this.prover.evaluate(multiplierInequality);
	this.prover.closeExp(sexp);
	this.prover.evaluate(baseInequality);
	this.prover.print([], 'ltmul2i');
	var result = this.prover.getLast();
	return this.prover.evaluate(result.left());	// For simplifying, 1 * 10 < 50 to 10 < 50
};

GH.ProofGenerator.evaluatorLessThan.prototype.close = function(result) {
	if (result) {
		return this.prover.closeExp(result);
	} else {
		return this.prover.getLast().right();
	}
};

GH.ProofGenerator.evaluatorLessThan.prototype.arbitraryNumbers = function(sexp, leftNum, rightNum) {
	var base = Math.pow(10, GH.numUtil.numOfDigits(leftNum) - 1);
	var leftMultiplier  = Math.floor(leftNum  / base);
	var rightResult = leftNum;
	var result = null;
	if (leftNum % base != 0) {
		rightResult = (leftMultiplier + 1) * base;
		result = this.addToBothSides(sexp, 0, rightResult - leftNum, leftNum, 'Numbers Get Higher Rounding Up');
		base = Math.pow(10, GH.numUtil.numOfDigits(rightResult) - 1);
		result = result.right();
	}
	while (10 * base <= rightNum) {
		result = result && this.prover.openExp(result, 'More Digits');
		base = 10 * base;
		this.prover.evaluate(this.prover.create('<', [rightResult, base]));
		rightResult = base;
		result = this.close(result);
	}
	var roundDown = GH.numUtil.mostSignificantDigit(rightNum);
	if (rightResult < roundDown) {
		result = result && this.prover.openExp(result, 'Higher First Digit');
		this.prover.evaluate(this.prover.create('<', [rightResult, roundDown]));
		rightResult = roundDown;
		result = this.close(result);
	}
	if (roundDown < rightNum) {
		result = result && this.prover.openExp(result, 'Higher Remaining Digits');
		this.prover.evaluate(this.prover.create('<', [roundDown, rightNum]));
		result = this.close(result);
	}
	
	if (result.parent) {
		result = result.parent;
	}
	return result;
};

GH.ProofGenerator.evaluatorLessThan.prototype.canAddTheorem = function(sexp) {
	var leftNum  = this.prover.calculate(sexp.left());
	var rightNum = this.prover.calculate(sexp.right());
	return ((rightNum <= 10) && (leftNum <= 10) && (leftNum < rightNum));
};

GH.ProofGenerator.evaluatorLessThan.prototype.theoremName = function(sexp) {
	return 'One-Digit Inequality';
};

GH.ProofGenerator.evaluatorLessThan.prototype.calculate = function(sexp) {
	var leftNum = this.prover.calculate(sexp.left());
	var rightNum = this.prover.calculate(sexp.right());
	return leftNum < rightNum;
};
// <license>
// This module implements a direct mode, in which changes to the editor
// window are reflected immediately into a stack view.

// text is a CanvasEdit object, stack is a canvas for drawing the stack view
// suggestArea is a place for suggesting proof steps.
GH.Direct = function(text, stack, suggestArea) {
    var self = this;
    this.text = text;
    this.text.clearImtrans();  // todo: hack
    this.stack = stack;
    this.text.addListener(function() { self.update(); });
    this.marker = null;
	this.prover = new GH.Prover(suggestArea, this);
};

/**
 * Split a string in a primary and secondary set of tokens. The secondary tokens
 * are used for styling the proof.
 *   - str: The string to split into tokens.
 *   - offset: The character position of the start of the string within the proof.
 */
GH.splitrange = function(str, offset) {
    function token(beg, end) {
		var tok = new String(str.substring(beg, end));
		tok.beg = offset + beg;
		tok.end = offset + end;
		return tok;
    }

    var result = [];
	var secondary = [];
    var beg = 0;
    for (var i = 0; i < str.length; i++) {
		var c = str.charAt(i);
		if (c == ' ') {
			if (i != beg) {
				result.push(token(beg, i));
			}
			beg = i + 1;
		} else if (c == "(" || c == ")") {
			if (i != beg) {
				result.push(token(beg, i));
			}
			result.push(token(i, i+1));
			beg = i + 1;
		} else if (c == '#') {
			// The string '##' indicates that what follows is a styling command.
			// These commands are placed in the set of secondary tokens.
			if ((i + 1 < str.length) && (str.charAt(i + 1) == '#')) {
				var tokens = GH.splitrange(str.substring(i + 2, str.length), offset + i + 2);
				secondary = tokens.primary;
			}
			if (i != beg) {
				result.push(token(beg, i));
			}
			beg = str.length;
			break;
		}
    }
    if (beg != str.length) {
		result.push(token(beg, str.length));
    }
    return {primary: result, secondary: secondary};
};

GH.Direct.replace_thmname = function (newname) {
    var elem = document.getElementById('thmname');
    while (elem.firstChild) {
      elem.removeChild(elem.firstChild);
    }
    elem.appendChild(document.createTextNode(newname));
    name = newname; // replace global 'name'.
};

GH.Direct.prototype.update = function() {
	var session = this.text.getSession();  // for ACE editing
	if (session && this.marker !== null) {
		session.removeMarker(this.marker);
		this.marker = null;
	}
	var auLink = document.getElementById("autounify");
	auLink.style.display='none';
	var thmctx = new GH.DirectThm(this.vg);
	this.thmctx = thmctx;
	var status = null;
	var i, loc;
	var offset = 0;
	var cursorPosition = this.text.getCursorPosition();
	this.stack.innerHTML = '';
	for (i = 0; i < this.text.numLines() && status == null; i++) {
		var line = this.text.getLine(i);
		thmctx.styleScanner.read_styling(line.replace(/\(|\)/g, ' $& '));
		var tokens = GH.splitrange(line, offset);
		var spl = tokens.primary;
		thmctx.applyStyling(tokens.secondary);
		for (var j = 0; j < spl.length; j++) {
			try {
				status = thmctx.tok(spl[j]);	
			} catch (ex) {
				if (ex.found && (ex.found.beg)) {
					auLink.style.display = 'inline';
					auLink.innerHTML = "AutoUnify: Replace " + ex.found + "[" + ex.found.beg
					+ ":" + ex.found.end + "]" + " with " + ex.expected + "?";
					var that = this;
					auLink.onclick = function() {
						if (auLink.onmouseout) {
							auLink.onmouseout();
						}
						that.text.splice(ex.found.beg, ex.found.end - ex.found.beg, ex.expected);
						that.update();
						if (auLink.style.display != 'none') {
							auLink.onmouseover();
						}
						return false;
					};
					var textarea = document.getElementById("canvas");
					if (textarea.setSelectionRange) {
						auLink.onmouseover = function() {
							var cursor = textarea.selectionEnd;
							auLink.onmouseout = function() {
								textarea.setSelectionRange(cursor, cursor);
								delete auLink.onmouseout;
							};
							textarea.setSelectionRange(ex.found.beg,
								ex.found.end);
						};			  
					}

				}
				status = "! " + ex;
			}
			if (status) {
				if (session) {
					var range = new this.text.Range(i, spl[j].beg-offset, i, spl[j].end-offset);
					var text = status;
					if (text.slice(0, 2) === '! ') {
						text = text.slice(2);
					}
				    this.marker = session.addMarker(range, "gh_error", "text", false);
				    session.setAnnotations([{row:i, column:spl[j].beg-offset, text:text, type:"error"}]);
				}
				loc = spl[j] + ' ' + spl[j].beg + ':' + spl[j].end;
				break;
			}
		}
		offset += line.length + 1;
	}
    if (thmctx.proofctx) {
    	pstack = thmctx.proofctx.mandstack;
		thmctx.history.push(thmctx.proofctx.stackHistory);
		var shownHistory = thmctx.history[thmctx.history.length - 1];
		for (var i = thmctx.history.length - 2; i >= 0; i--) {
			for (var j = 0; j < thmctx.history[i].length; j++) {
				if (cursorPosition <= thmctx.history[i][j].end) {
					shownHistory = thmctx.history[i]
				}
			}
		}
		for (var j = 0; j < shownHistory.length; j++) {
			shownHistory[j].displayStack(this.stack, cursorPosition);
		}
		
		if (pstack.length > 0) {
			for (i = 0; i < pstack.length; i++) {
				this.stack.appendChild(GH.Direct.textToHtml(GH.sexptohtml(pstack[i][1])));
			}
		}
		this.stack.appendChild(GH.Direct.textToHtml('&nbsp;'));
    }
	this.thmctx.clearNewSyms();
    if (status) {
		this.stack.appendChild(GH.Direct.textToHtml(loc + ' ' + status));
    } else {
    	if (session) {
    		session.setAnnotations([]);
    	}
    }
	this.prover.update(thmctx.proofctx.stackHistory, thmctx.proofctx.mandstack);
		
	if (thmctx.proofctx) {
		return thmctx.proofctx.stackHistory;
	} else {
		return null;
	}
};

/**
 * The minimum number of lines in the displayed stack. Blank lines are added if the
 * stack is smaller.
 */
GH.Direct.MINIMUM_LINES = 12;

GH.Direct.textToHtml = function(text) {
	var div = document.createElement("div");
	div.innerHTML = text;
	return div;
}

GH.DirectThm = function(vg) {
	this.vg = vg;
	this.thmname = null;
	this.sexpstack = [];
	this.hypmap = {};
	this.state = GH.DirectThm.StateType.THM;
	this.proofctx = null;
	this.fv = null;
	this.hyps = null;
	this.concl = null;

	// A list of symbols added in this directThm.
	this.newSyms = [];

	// A set of the previous stack histories. Used when there are multiple proofs in the editor.
	this.history = [];
	
	this.styleScanner = new GH.StyleScanner();

	// The depth at the current position in the proof. Proof steps with higher depths are less important.
	this.depth = 0;
};

GH.DirectThm.StateType = {
	THM : 0,
	POST_THM : 1,
	NAME : 2,
	POST_NAME : 3,
	FREE_VARIABLE : 4,
	POST_FREE_VARIABLE : 5,
	HYPOTHESES : 6,
	POST_HYPOTHESES : 7,
	S_EXPRESSION : 8,
	POST_S_EXPRESSION : 9,
	PROOF_END : 10
};

GH.DirectThm.prototype.clearNewSyms = function() {
	for (var i = 0; i < this.newSyms.length; i++) {
		delete this.vg.syms[this.newSyms[i]];
	}
};

GH.DirectThm.prototype.pushEmptySExp_ = function(tok) {
	var newSExp = [];
	newSExp.beg = tok.beg;
	this.sexpstack.push(newSExp);
}

// Styling tag to increment the depth. Proof steps with a higher depth are
// less important and less visible.
GH.DirectThm.INCREMENT_DEPTH_TAG_ = '<d>';

// Styling tag to decrement the depth. Proof steps with a lower depth are
// more important and more visible.
GH.DirectThm.DECREMENT_DEPTH_TAG_ = '</d>';

// Update the depth based on the styling.
GH.DirectThm.prototype.applyStyling = function(styling) {
	if (styling[0] == GH.DirectThm.INCREMENT_DEPTH_TAG_) {
		this.depth++;
	} else if (styling[0] == GH.DirectThm.DECREMENT_DEPTH_TAG_) {
		this.depth--;
	}
}

GH.DirectThm.prototype.tok = function(tok) {
	var stateType = GH.DirectThm.StateType;
	var state = this.state;
	var thestep = null;
	var i, pc;
	switch (state) {
		case stateType.THM:
			if (tok == 'thm') {
				this.state = stateType.POST_THM;
			} else {
				return 'expected thm';
			}
			break;
		case stateType.POST_THM:
			if (tok == '(') {
				this.state = stateType.NAME;
			} else {
				return 'expected (';
			}
			break;
		case stateType.NAME:
			if (tok == '(' || tok == ')') {
				return 'expected thm name';
			} else {
				this.thmname = tok;
				if (this.vg.syms.hasOwnProperty(tok)) {
					return "A symbol of name '" + tok + "' already exists.";
				}
				// Is this the best place to do this?
				GH.Direct.replace_thmname(tok);
				this.state = stateType.POST_NAME;
			}
			break;
		case stateType.POST_NAME:
			if (tok == '(') {
			  this.pushEmptySExp_(tok);
				this.state = stateType.FREE_VARIABLE;
			} else {
				return "expected ( to open dv's";
			}
			break;
		case stateType.POST_FREE_VARIABLE:
			if (tok == '(') {
			  this.pushEmptySExp_(tok);
				this.state = stateType.HYPOTHESES;
			} else {
				return "expected ( to open hyps";
			}
			break;
		case stateType.POST_HYPOTHESES:
			if (tok == '(') {
			  this.pushEmptySExp_(tok);
				this.state = stateType.S_EXPRESSION;
			} else if (tok == ')') {
				return 'expected proof stmt';
			} else {
				thestep = tok;
				this.state = stateType.POST_S_EXPRESSION;
			}
			break;
		case stateType.POST_S_EXPRESSION:
			if (tok == '(') {
			  this.pushEmptySExp_(tok);
				this.state = stateType.S_EXPRESSION;
			} else if (tok == ')') {
				pc = this.proofctx;
				if (pc.mandstack.length != 0) {
					//this.proofctx.stackHistory.push(new GH.ProofStep([], tok + ' Error', tok.beg, tok.end, [], true, false, 0, null));
					return '\n\nExtra mandatory hypotheses on stack at the end of the proof.';
				}
				if (pc.stack.length != 1) {
					return '\n\nStack must have one term at the end of the proof.';
				}
				if (!GH.sexp_equals(pc.stack[0], this.concl)) {
					return ('\n\nStack has:\n ' + GH.sexp_to_string(pc.stack[0]) +
							'\nWanted:\n ' + GH.sexp_to_string(this.concl));
				}
				
				var new_hyps = [];
				if (this.hyps) {
					for (j = 1; j < this.hyps.length; j += 2) {
						new_hyps.push(this.hyps[j]);
					}
				}
				// Hmm, could possibly save proofctx.varmap instead of this.syms...
				// If we go to index variable expression storage we don't need either
				this.vg.add_assertion('thm', this.thmname, this.fv, new_hyps, this.concl,
								   this.proofctx.varlist, this.proofctx.num_hypvars,
								   this.proofctx.num_nondummies, this.vg.syms, this.styleScanner.get_styling());
				this.newSyms.push(this.thmname);

				this.state = stateType.THM;
				this.concl = null;
				this.hypmap = {};
			} else {
				thestep = tok;
			}
			break;
		case stateType.FREE_VARIABLE:
		case stateType.HYPOTHESES:
		case stateType.S_EXPRESSION:
			if (tok == '(') {
			  this.pushEmptySExp_(tok);
			} else if (tok == ')') {
				if (this.sexpstack.length == 1) {
					// When the last s-expression is popped, increment the state.
					thestep = this.sexpstack.pop();
					thestep.end = tok.end;
					this.state += 1;
				} else {
					// Otherwise, attach the last s-expression as a child of the one before it.
					var last = this.sexpstack.pop();
					last.end = tok.end;
					this.sexpstack[this.sexpstack.length - 1].push(last);
				}
			} else {
				this.sexpstack[this.sexpstack.length - 1].push(tok);
			}
			break;
		case stateType.PROOF_END:
			this.proofctx.stackHistory.push(new GH.ProofStep('Error', [], tok + ' Extra Junk After Proof', tok.beg, tok.end, [], true, false, 0, null));
			return 'extra junk after proof';
			break;
	}

  state = this.state;
  if (state == stateType.POST_FREE_VARIABLE) {
		// thestep has dv list
		this.fv = thestep;
		if (this.proofctx) {
			this.history.push(this.proofctx.stackHistory);
		}
		this.proofctx = new GH.ProofCtx();
		this.proofctx.varlist = [];
		this.proofctx.varmap = {};
	} else if (state == stateType.POST_HYPOTHESES) {
		if (thestep.length & 1) {
			return 'Odd length hypothesis list';
		}
		for (i = 0; i < thestep.length; i += 2) {
			var hypname = thestep[i];
			if (GH.typeOf(hypname) != 'string') {
				return 'Hyp label must be string';
			}
			if (this.hypmap.hasOwnProperty(hypname)) {
				return 'Repeated hypothesis label ' + hypname;
			}
			var hyp = thestep[i + 1];
			try {
					this.vg.kind_of(hyp, this.proofctx.varlist,
				this.proofctx.varmap, false, this.vg.syms);
			} catch (e1) {
					return "!" + e1;
			}
			this.hypmap[hypname] = hyp;
			this.hyps = thestep;
			//log ('hypothesis: ' + hypname + ' ' + GH.sexp_to_string(hyp));
		}
		this.proofctx.num_hypvars = this.proofctx.varlist.length;
  } else if (state == stateType.POST_S_EXPRESSION && this.concl == null) {
		pc = this.proofctx;
		try {
			this.vg.kind_of(thestep, pc.varlist,
											pc.varmap, false, this.vg.syms);
			pc.num_nondummies = pc.varlist.length;
			pc.fvvarmap = this.vg.fvmap_build(this.fv, pc.varlist, pc.varmap);
		} catch (e2) {
			return "! " + e2;
		}
		this.concl = thestep || 'null';
  } else if (thestep != null && state == stateType.POST_S_EXPRESSION) {
		try {
			this.vg.check_proof_step(this.hypmap, thestep, this.proofctx, this.depth);
		} catch (e3) {
			if (e3.found) {
				throw e3;
			}
			var stackHistory = this.proofctx.stackHistory;
			var removed = stackHistory.splice(0);
			stackHistory.push(new GH.ProofStep('Error', removed, e3, tok.beg, tok.end, [], true, false, 0, null));
			return "! " + e3;
		}
  }
  return null;
};

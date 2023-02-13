
module.exports = function FastScript(mod) {
	const { player } = mod.require.library;

	let skills = require("./skills.js");
	let lastTimeout = null;
	let skillLocksTimer = null;
	const skillLocks = new Set();

	mod.game.initialize("me.abnormalities");

	mod.command.add("fast", {
		"reload": () => {
			skills = reloadModule("./skills.js");
			mod.command.message("Configuration reloaded");
		},
		"$default"() {
			mod.settings.enabled = !mod.settings.enabled;
			mod.command.message(`Module is now ${mod.settings.enabled ? "enabled" : "disabled"}.`);
		}
	});

	mod.hook("S_ACTION_STAGE", 9, { "order": -1000000, "filter": { "fake": null } }, event => {
		if (!mod.settings.enabled || !mod.game.me.is(event.gameId) || skills[mod.game.me.class] === undefined) return;

		const skillBaseId = Math.floor(event.skill.id / 1e4);
		const skillInfo = skills[mod.game.me.class].find(e => e.id === skillBaseId && (e.subId === undefined || e.subId === event.skill.id % (e.subId >= 100 ? 1000 : 100)) &&
				(e.hasAbn === undefined || mod.game.me.abnormalities[e.hasAbn.toString()]) &&
				(e.notHasAbn === undefined || !mod.game.me.abnormalities[e.notHasAbn.toString()]));

		if (skillInfo) {

			if (skillInfo.delay && skillInfo.delay > 0) {

				skillLocks.add(event.skill.id);
				mod.clearTimeout(skillLocksTimer);

				skillLocksTimer = mod.setTimeout(() => {
					skillLocks.delete(event.skill.id);
				}, 3000);

				lastTimeout = mod.setTimeout(() => {
					mod.send("S_ACTION_END", 5, {
						"gameId": event.gameId,
						"loc": {
							"x": event.loc.x,
							"y": event.loc.y,
							"z": event.loc.z
						},
						"w": event.w,
						"templateId": event.templateId,
						"skill": event.skill.id,
						"type": 12394123,
						"id": event.id
					});
				}, skillInfo.fixedDelay ? skillInfo.delay : skillInfo.delay / player.aspd);
			}

			if (skillInfo.speed && skillInfo.speed > 0) {

				const speed = (player.aspd / 100) * skillInfo.speed;

				event.speed += speed;
				event.projectileSpeed += speed;

				return true;
			}
		}
	});

	mod.hook("S_ACTION_END", 5, { "order": -1000000, "filter": { "fake": true } }, event => {
		if (!mod.settings.enabled || !mod.game.me.is(event.gameId) || skills[mod.game.me.class] === undefined) return;

		const skillBaseId = Math.floor(event.skill.id / 1e4);
		const skillInfo = skills[mod.game.me.class].find(e => e.id === skillBaseId && (e.subId === undefined || e.subId === event.skill.id % (e.subId >= 100 ? 1000 : 100)) &&
				(e.hasAbn === undefined || mod.game.me.abnormalities[e.hasAbn.toString()]) &&
				(e.notHasAbn === undefined || !mod.game.me.abnormalities[e.notHasAbn.toString()]));

		skillLocks.delete(event.skill.id);
		mod.clearTimeout(skillLocksTimer);

		if (lastTimeout && skillInfo) {

			lastTimeout = null;

			if (event.type == 12394123) {
				event.type = 4;

				return true;
			}

			return false;
		}
	});

	mod.hook("C_CANCEL_SKILL", 3, event => {
		if (!mod.settings.enabled || skills[mod.game.me.class] === undefined) return;

		skillLocks.delete(event.skill.id);
		mod.clearTimeout(skillLocksTimer);

		if (lastTimeout) {
			mod.clearTimeout(lastTimeout);
			lastTimeout = null;
		}
	});

	mod.hook("S_EACH_SKILL_RESULT", 14, { "order": -10000000 }, event => {
		if (!mod.settings.enabled || !lastTimeout || !mod.game.me.is(event.target) || !event.reaction.enable) return;

		mod.clearTimeout(lastTimeout);
		lastTimeout = null;
	});

	mod.hook("C_PRESS_SKILL", 4, { "order": -1000000 }, startSkill);
	mod.hook("C_START_SKILL", 7, { "order": -1000000 }, startSkill);
	mod.hook("C_START_INSTANCE_SKILL", 7, { "order": -1000000 }, startSkill);
	mod.hook("C_START_TARGETED_SKILL", 7, { "order": -1000000 }, startSkill);

	function startSkill(event) {
		if (!mod.settings.enabled || !lastTimeout || skillLocks.size === 0) return;

		const skillBaseId = Math.floor(event.skill.id / 1e4);
		const skillInfo = skills[mod.game.me.class].find(e => e.id === skillBaseId && (e.subId === undefined || e.subId === event.skill.id % (e.subId >= 100 ? 1000 : 100)) &&
				(e.hasAbn === undefined || mod.game.me.abnormalities[e.hasAbn.toString()]) &&
				(e.notHasAbn === undefined || !mod.game.me.abnormalities[e.notHasAbn.toString()]));

		if (skillInfo === undefined || skillInfo.unlock !== true) {
			mod.send("S_CANNOT_START_SKILL", 4, { "skill": event.skill });

			return false;
		}
	}

	function reloadModule(modToReload) {
		delete require.cache[require.resolve(modToReload)];
		return require(modToReload);
	}
};
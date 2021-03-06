const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const config = require("../config.json");

var client;

exports.init = (cl) => {
	client = cl;
}

exports.getRole = (role) => {
	if (!role) return null;
	if (typeof role === "object") return role;
	if (/<@&\d+>/.test(role) || !isNaN(role)) { //mention or ID
		role = client.guilds.get(config.guild).roles.get(role.match(/\d+/)[0]);
	} else { //name
		role = client.guilds.get(config.guild).roles.find(x => x.name.toLowerCase() === role.toLowerCase());
	}
	return role || null;
}

exports.getUser = (user) => {
	if (!user) return null;
	if (typeof user === "object") return user;
	if (/<@!?\d+>/.test(user) || !isNaN(user)) { //mention or ID
		user = client.guilds.get(config.guild).members.get(user.match(/\d+/)[0]);
	} else if (/.+#\d{4}$/.test(user)) { //tag
		user = client.guilds.get(config.guild).members.array().find(x => user === `${x.user.username}#${x.user.discriminator}`);
	} else { //name
		let guildMembers = client.guilds.get(config.guild).members;
		user = guildMembers.find(x => x.user.username.toLowerCase() === user.toLowerCase())
			|| guildMembers.find(x => (x.nickname || x.user.username).toLowerCase() === user.toLowerCase())
			|| guildMembers.find(x => x.user.username.toLowerCase().includes(user.toLowerCase()))
			|| guildMembers.find(x => (x.nickname || x.user.username).toLowerCase().includes(user.toLowerCase()));
	}
	return user || null;
}

exports.getChannel = (channel) => {
	if (typeof channel === "object") return channel;
	return client.guilds.get(config.guild).channels.get(channel) || null;
}

exports.userHasRole = (user, role) => {
	user = this.getUser(user);
	role = this.getRole(role);
	if (!user || !role) return false;
	return client.guilds.get(config.guild).members.get(user.id).roles.has(role.id);
}

exports.plural = (val, text, suffix = "s") => {
	return val === 1 ? text : text + suffix;
}

exports.XMLHttpRequest = (callback, url) => {
	let xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function () {
		if (this.readyState == 4 && this.status == 200) {
			return callback(JSON.parse(xhttp.responseText));
		}
		if (this.readyState == 4 && this.status == 404) {
			console.log("ERROR: Couldn't retrieve JSON from URL");
			return callback(null);
		}
	}
	xhttp.open("GET", url, true);
	xhttp.send();
}

exports.sendMessage = (channel, text, delete_message = 0) => {
    channel = this.getChannel(channel);
    if (!channel) return null;
    channel.send(text).then(message => {
		if (delete_message) {
			this.deleteMessage(message, config.delete_response_secs * 1000);
		}
	}).catch(err => {
		console.log(`ERROR: Couldn't send message in #${message.channel.name} - ${err}`);
	});
}

exports.editMessage = (message, text, delete_message = 0) => {
	message.edit(text).then(message => {
		if (delete_message) {
			this.deleteMessage(message, config.delete_response_secs * 1000);
		}
	}).catch(err => {
		console.log(`ERROR: Couldn't edit message in #${message.channel.name} - ${err}`);
	});
}

exports.deleteMessage = (message, delete_message = 0) => {
	if (delete_message) {
		setTimeout(() => {
			message.delete().catch(err => {
				console.log(`ERROR: Couldn't auto delete message in #${message.channel.name} - ${err}`);
			});
		}, config.delete_response_secs * 1000);
	} else {
		message.delete().catch(err => {
			console.log(`ERROR: Couldn't delete message in #${message.channel.name} - ${err}`);
		});
	}
}

exports.fetchMessage = (callback, cfg_group) => {
	channel = this.getChannel(cfg_group.channel);
	if (!channel) {
		console.log("ERROR: Couldn't get channel to fetch message");
		return callback(null);
	}
	channel.fetchMessage(cfg_group.message).then(message => {
		return callback(message);
	}).catch(() => {
		console.log(`ERROR: Couldn't fetch message from #${channel.name}`);
	});
}

exports.sortServers = (servers) => {
	if (servers.hasOwnProperty("serverList")) {
        servers = servers.serverList;
    } else {
        return null;
	}
	
    servers.sort((a, b) => {
        if (a.currentPlayers === b.currentPlayers) {
			if (a.name.toLowerCase() === b.name.toLowerCase()) {
				return `${a.IPv4Address}:${a.port}`.localeCompare(`${b.IPv4Address}:${b.port}`);
			}
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        }
        return b.currentPlayers - a.currentPlayers;
	});

	servers = servers.slice(0, 25);
	
    for (let server of servers) {
        server.playerList.sort((a, b) => {
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });
	}
	
    return servers;
}

exports.isMod = (user) => {
	return config.mod_roles.some(role => {
		return this.userHasRole(user, role);
	});
}

exports.updatePresence = () => {
	this.XMLHttpRequest(servers => {
		servers = this.sortServers(servers);
		let total_players = servers.reduce((t, x) => t + x.currentPlayers, 0);
		client.user.setActivity(`${total_players} in KAG | ${config.prefix}help`, { type: 'WATCHING' });
	}, 'https://api.kag2d.com/v1/game/thd/kag/servers?filters=[{"field":"current","op":"eq","value":"true"},{"field":"connectable","op":"eq","value":true},{"field":"currentPlayers","op":"gt","value":"0"}]');

	//loop every minute
	let ms = config.server_list.update_interval_secs * 1000;
	let delay = ms - new Date() % ms;
	setTimeout(this.updatePresence, delay);
}
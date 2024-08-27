let canvas_width = 100;
let canvas_height = canvas_width;

let frames_per_second = 10;
let frame_time = 1.0 / frames_per_second;

let sys = {
	curr_time: 0,
	prev_time: 0,
	paused: false,
	mouse_held: false,
	add_held: false,
	delete_held: false,
	buffers: [[], []],
	curr_buffer: [],
	next_buffer: [],
};

let canvas;
let ctx;
let pixels;

function main() {
	canvas = document.getElementById("canvas");
	ctx = canvas.getContext("2d", {willReadFrequently: true});
	register_events();
	window_resize();
	sys.start_time = Date.now();
	sys.curr_time = sys.start_time;
	sys.prev_time = sys.start_time;
	init_slots();
	render();
}
function register_events() {
	window.addEventListener("resize", window_resize);
	window.addEventListener("keydown", window_keydown);
	window.addEventListener("mousedown", window_mousedown);
	window.addEventListener("mouseup", window_mouseup);
	window.addEventListener("mousemove", window_mousemove);
	window.addEventListener("contextmenu", window_contextmenu);
}
function window_keydown(event) {
	if (event.code == "Space") {
		toggle_pause();
	}
}
function window_mousedown(event) {
	sys.mouse_held = true;
	if (event.buttons & 1) {
		sys.add_held = true;
	}
	if (event.buttons & 2) {
		sys.delete_held = true;
	}
	event.preventDefault();
}
function window_mouseup(event) {
	sys.mouse_held = false;
	sys.add_held = false;
	sys.delete_held = false;
	event.preventDefault();
}
function window_mousemove(event) {
	sys.mouse_x = event.clientX;
	sys.mouse_y = event.clientY;
}
function window_contextmenu(event) {
	event.preventDefault();
}
function window_resize(event) {
	resize_canvas();
}
function update_input() {
	if (sys.mouse_held) {
		let canvas_rect = canvas.getBoundingClientRect();
		if (canvas_rect.left <= sys.mouse_x && sys.mouse_x < canvas_rect.right &&
		    canvas_rect.top <= sys.mouse_y && sys.mouse_y < canvas_rect.bottom) {
			let canvas_x = sys.mouse_x - canvas_rect.left;
			let canvas_y = sys.mouse_y - canvas_rect.top;
		    let viewport_width = canvas_rect.right - canvas_rect.left;
		    let viewport_height = canvas_rect.bottom - canvas_rect.top;
		    let grid_x = Math.floor(canvas_x / (viewport_width / canvas.width));
		    let grid_y = Math.floor(canvas_y / (viewport_height / canvas.height));
		    let slot_index = get_slot_2d_index(sys.curr_buffer, grid_x, grid_y);
		    let slot = sys.curr_buffer.slots[slot_index];
		    if (sys.add_held) {
			    slot = 1;
			}
		    if (sys.delete_held) {
			    slot = 0;
			}
		    sys.curr_buffer.slots[slot_index] = slot;
		    sys.next_buffer.slots[slot_index] = slot;
		}
	}
}
function resize_canvas() {
	canvas.width = canvas_width;
	canvas.height = canvas_height;
}
function render() {
	sys.curr_time = Date.now();

	ctx.clearColor = "rgba(0,0,0,0)";
	ctx.clearRect(0,0, canvas.width, canvas.height);

	update_input();

	if (sys.paused == false) {
		let elapsed = (sys.curr_time - sys.prev_time) / 1000;
		// don't freeze when switching back to the tab after a long time
		if (elapsed > 10.0) {
			elapsed = 10.0;
		}
		if (elapsed > frame_time) {
			while (elapsed > frame_time) {
				swap_buffers();
				calculate_next_frame();
				elapsed -= frame_time;
			}
			sys.prev_time = sys.curr_time - elapsed * 1000;
		}
	}

	pixels = ctx.getImageData(0,0, canvas.width, canvas.height);

	for (let i = 0; i < sys.curr_buffer.slots.length; i += 1) {
		let slot = sys.curr_buffer.slots[i];
		let x = i % canvas.width;
		let y = Math.floor(i / canvas.width);
		let luminosity = slot * 255;
		pixels.data[i*4+0] = luminosity;
		pixels.data[i*4+1] = luminosity;
		pixels.data[i*4+2] = luminosity;
		pixels.data[i*4+3] = 255;
	}

	ctx.putImageData(pixels, 0,0);

	window.requestAnimationFrame(render);
}

function toggle_pause() {
	sys.paused = sys.paused == false;
	sys.prev_time = sys.curr_time;
	copy_buffers(sys.curr_buffer, sys.next_buffer);
}


const Life_Buffer = {
	width: 0,
	height: 0,
	choice_count: 0,
	slots: null,
};
function make_life_buffer(width, height, choice_count = 4) {
	let buffer = Object.assign({}, Life_Buffer);
	buffer.width = width;
	buffer.height = height;
	buffer.choice_count = choice_count;
	buffer.slots = new Array(buffer.width * buffer.height).fill(0);
	return buffer;
}
function clear_buffer(buffer) {
	for (let i = 0; i < buffer.slots.length; i += 1) {
		buffer.slots[i] = 0;
	}
}
function copy_buffers(a, b) {
	for (let i = 0; i < a.slots.length; i += 1) {
		b.slots[i] = a.slots[i];
	}
}

function init_slots() {
	sys.buffers = new Array(2);
	sys.buffers[0] = make_life_buffer(canvas.width, canvas.height);
	sys.buffers[1] = make_life_buffer(canvas.width, canvas.height);
	sys.buffer_index = 0;
	sys.curr_buffer = sys.buffers[sys.buffer_index];
	sys.next_buffer = sys.buffers[sys.buffer_index+1];
	init_sources();
}
function init_sources() {
	init_glider_wall();
	// init_glider_crash();
	// init_random();
	copy_buffers(sys.curr_buffer, sys.next_buffer);
}
function init_glider_wall() {
	let buffer = sys.curr_buffer;
	for (let y = 0; y < canvas.height; y += 5) {
		for (let x = 0; x < canvas.width; x += 5) {
			init_glider(buffer, x, y);
		}
	}
}
function init_glider_crash() {
	let buffer = sys.curr_buffer;
	for (let y = 0; y < canvas.height; y += 6) {
		for (let x = 0; x < canvas.width; x += 6) {
			init_glider(buffer, x, y);
		}
	}
}
function init_glider(buffer, x, y) {
	let top_index   = get_slot_2d_index(sys.curr_buffer, x+1, y+0);
	let right_index = get_slot_2d_index(sys.curr_buffer, x+2, y+1);
	let bottom_left_index  = get_slot_2d_index(sys.curr_buffer, x+0, y+2);
	let bottom_index       = get_slot_2d_index(sys.curr_buffer, x+1, y+2);
	let bottom_right_index = get_slot_2d_index(sys.curr_buffer, x+2, y+2);
	buffer.slots[top_index] = 1;
	buffer.slots[right_index] = 1;
	buffer.slots[bottom_left_index] = 1;
	buffer.slots[bottom_index] = 1;
	buffer.slots[bottom_right_index] = 1;
}
function init_random(buffer) {
	for (let i = 0; i < buffer.slots.length; i += 1) {
		buffer.slots[i] = Math.floor(Math.random() * buffer.choice_count);
	}
}
function swap_buffers() {
	sys.buffer_index = (sys.buffer_index + 1) % 2;
	sys.curr_buffer = sys.buffers[sys.buffer_index];
	let next_index = (sys.buffer_index + 1) % 2;
	sys.next_buffer = sys.buffers[next_index];
}
function calculate_next_frame() {
	copy_buffers(sys.curr_buffer, sys.next_buffer);
	// clear_buffer(sys.next_buffer);
	for (let i = 0; i < sys.curr_buffer.slots.length; i += 1) {
		let x = i % canvas.width;
		let y = Math.floor(i / canvas.width);
		let slot = sys.curr_buffer.slots[i];

		let up_left_index  = get_slot_2d_index(sys.curr_buffer, x-1, y-1);
		let up_index       = get_slot_2d_index(sys.curr_buffer, x-0, y-1);
		let up_right_index = get_slot_2d_index(sys.curr_buffer, x+1, y-1);

		let left_index  = get_slot_2d_index(sys.curr_buffer, x-1, y-0);
		let self_index  = get_slot_2d_index(sys.curr_buffer, x-0, y-0);
		let right_index = get_slot_2d_index(sys.curr_buffer, x+1, y-0);

		let down_left_index  = get_slot_2d_index(sys.curr_buffer, x-1, y+1);
		let down_index       = get_slot_2d_index(sys.curr_buffer, x-0, y+1);
		let down_right_index = get_slot_2d_index(sys.curr_buffer, x+1, y+1);

		let neighbor_indexes = [
		                        up_left_index,   up_index,   up_right_index,
		                        left_index,                  right_index,
		                        down_left_index, down_index, down_right_index,
		                       ];

		let neighbor_states = new Array(neighbor_indexes.length);
		for (let j = 0; j < neighbor_indexes.length; j += 1) {
			let index = neighbor_indexes[j];
			neighbor_states[j] = sys.curr_buffer.slots[index];
		}
		let alive_count = 0;
		for (let j = 0; j < neighbor_states.length; j += 1) {
			let state = neighbor_states[j];
			if (state == 1) {
				alive_count += 1;
			}
		}
		if (slot == 1) {
			if (alive_count < 2) {
				sys.next_buffer.slots[i] = 0;
			}
			else if (alive_count > 3) {
				sys.next_buffer.slots[i] = 0;
			}
			else {
				sys.next_buffer.slots[i] = 1;
			}
		}
		if (slot == 0) {
			if (alive_count == 3) {
				sys.next_buffer.slots[i] = 1;
			}
		}
	}
}
function get_slot_2d_index(buffer, x, y) {
	if (x < 0) {
		x += (Math.floor(Math.abs(x) / canvas.width) + 1) * canvas.width;
	}
	else if (x >= canvas.width) {
		x -= Math.floor(Math.abs(x) / canvas.width) * canvas.width;
	}
	if (y < 0) {
		y += (Math.floor(Math.abs(y) / canvas.height) + 1) * canvas.height;
	}
	else if (y >= canvas.height) {
		y -= Math.floor(Math.abs(y) / canvas.height) * canvas.height;
	}
	return y * canvas.width + x;
}
function get_median(arr) {
	let histogram = get_histogram(arr);
	let keys = Object.keys(histogram);
	let max_key = 0;
	let max_value = 0;
	for (let i = 0; i < keys.length; i += 1) {
		let key = keys[i];
		let value = histogram[key];
		if (key == "0") {
			continue;
		}
		if (value > max_value) {
			max_key = key;
			max_value = value;
		}
	}
	return parseInt(max_key);
}
function get_histogram(arr) {
	let buckets = {};
	for (let i = 0; i < arr.length; i += 1) {
		let value = arr[i];
		if (!buckets.hasOwnProperty(value)) {
			buckets[value] = 1;
		}
		else {
			buckets[value] += 1;
		}
	}
	return buckets;
}
function top_n_from(count, arr) {
	let results = new Array(count).fill(0);
	let max_values = new Array(count).fill(0);
	let histogram = get_histogram(arr);
	let keys = Object.keys(histogram);
	for (let i = 0; i < keys.length; i += 1) {
		let key = keys[i];
		let value = histogram[key];
		if (value > results[0]) {
			for (let j = 0; j < count-1; j += 1) {
				max_values[j+1] = max_values[j];
				results[j+1] = results[j];
			}
			max_values[0] = value;
			results[0] = parseInt(key);
		}
	}
	return results;
}
function get_many_by_index(arr, indexes) {
	let results = new Array(indexes.length);
	for (let i = 0; i < indexes.length; i += 1) {
		let index = indexes[i];
		results[i] = arr[index];
	}
	return results;
}
function many_randoms(count, max) {
	let results = new Array(count);
	for (let i = 0; i < count; i += 1) {
		results[i] = Math.floor(Math.random() * max);
	}
	return results;
}

main();